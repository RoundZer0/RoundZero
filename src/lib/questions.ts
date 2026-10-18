import pool from '@/lib/db/postgres';
import { Question, Difficulty, DatasetStats, PointsConfig } from '@/types/oa';

export interface FilterParams {
  difficulties?: Difficulty[];
  tags?: string[];
  search?: string;
  questionIds?: number[];
  pointsConfig?: PointsConfig;
  onlySummary?: boolean;
}

let cachedDatasetStats: DatasetStats | null = null;
let cachedDatasetStatsTime = 0;
const STATS_CACHE_TTL = 1000 * 60 * 30; // 30 mins in-memory cache

export function mapRowToQuestion(row: any): Question {
  return {
    id: Number(row.id),
    taskId: row.task_id || row.taskId || `task-${row.id}`,
    title: row.title,
    difficulty: row.difficulty as Difficulty,
    points: Number(row.points) || 100,
    tags: Array.isArray(row.tags)
      ? row.tags
      : typeof row.tags === 'string'
      ? JSON.parse(row.tags)
      : [],
    problemDescription: row.problem_description || row.problemDescription || '',
    starterCode: row.starter_code || row.starterCode || '',
    entryPoint: row.entry_point || row.entryPoint || 'Solution().solve',
    starterCodes: row.starter_codes || row.starterCodes || undefined,
    inputOutput: Array.isArray(row.input_output)
      ? row.input_output
      : typeof row.input_output === 'string'
      ? JSON.parse(row.input_output)
      : [],
  };
}

export async function getAllQuestionsFromDB(): Promise<Question[]> {
  try {
    const res = await pool.query('SELECT * FROM questions ORDER BY id ASC');
    return res.rows.map(mapRowToQuestion);
  } catch (error) {
    console.error('Error fetching all questions from Neon DB:', error);
    return [];
  }
}

export async function getQuestionByIdFromDB(id: number): Promise<Question | undefined> {
  try {
    const res = await pool.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return undefined;
    return mapRowToQuestion(res.rows[0]);
  } catch (error) {
    console.error(`Error fetching question ${id} from Neon DB:`, error);
    return undefined;
  }
}

export async function getDatasetStatsFromDB(): Promise<DatasetStats> {
  if (cachedDatasetStats && Date.now() - cachedDatasetStatsTime < STATS_CACHE_TTL) {
    return cachedDatasetStats;
  }

  try {
    const totalRes = await pool.query('SELECT COUNT(*) FROM questions');
    const totalQuestions = parseInt(totalRes.rows[0].count, 10);

    const diffRes = await pool.query(
      'SELECT difficulty, COUNT(*) as count FROM questions GROUP BY difficulty'
    );
    const difficultyCounts: Record<Difficulty, number> = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
    };
    diffRes.rows.forEach((row) => {
      if (row.difficulty in difficultyCounts) {
        difficultyCounts[row.difficulty as Difficulty] = parseInt(row.count, 10);
      }
    });

    const tagsRes = await pool.query('SELECT tags FROM questions');
    const tagMap: Record<string, number> = {};
    tagsRes.rows.forEach((row) => {
      const tags = Array.isArray(row.tags)
        ? row.tags
        : typeof row.tags === 'string'
        ? JSON.parse(row.tags)
        : [];
      tags.forEach((tag: string) => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });

    const tagCounts = Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    cachedDatasetStats = {
      totalQuestions,
      difficultyCounts,
      tagCounts,
    };
    cachedDatasetStatsTime = Date.now();

    return cachedDatasetStats;
  } catch (error) {
    console.error('Error fetching dataset stats from Neon DB:', error);
    if (cachedDatasetStats) return cachedDatasetStats;
    return {
      totalQuestions: 0,
      difficultyCounts: { Easy: 0, Medium: 0, Hard: 0 },
      tagCounts: [],
    };
  }
}

export async function filterQuestionsFromDB(params: FilterParams): Promise<Question[]> {
  try {
    const selectCols = params.onlySummary
      ? 'id, task_id, title, difficulty, points, tags'
      : '*';
    let query = `SELECT ${selectCols} FROM questions WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.difficulties && params.difficulties.length > 0) {
      query += ` AND difficulty = ANY($${paramIndex})`;
      queryParams.push(params.difficulties);
      paramIndex++;
    }

    if (params.search && params.search.trim() !== '') {
      const term = `%${params.search.toLowerCase().trim()}%`;
      query += ` AND (LOWER(title) LIKE $${paramIndex} OR id::text = $${paramIndex + 1})`;
      queryParams.push(term, params.search.trim());
      paramIndex += 2;
    }

    if (params.questionIds && params.questionIds.length > 0) {
      query += ` AND id = ANY($${paramIndex})`;
      queryParams.push(params.questionIds);
      paramIndex++;
    }

    query += ' ORDER BY id ASC';

    const res = await pool.query(query, queryParams);
    let result = res.rows.map(mapRowToQuestion);

    // Apply tag filter in JS if tags provided (handles JSONB tag array efficiently)
    if (params.tags && params.tags.length > 0) {
      const tagSet = new Set(params.tags.map((t) => t.toLowerCase()));
      result = result.filter((q) => q.tags.some((t) => tagSet.has(t.toLowerCase())));
    }

    // Apply custom points config
    if (params.pointsConfig) {
      const pConfig = params.pointsConfig;
      result = result.map((q) => ({
        ...q,
        points: pConfig[q.difficulty] || q.points,
      }));
    }

    return result;
  } catch (error) {
    console.error('Error filtering questions from Neon DB:', error);
    return [];
  }
}

export interface PaginatedQuestionsResult {
  questions: Question[];
  totalMatches: number;
}

export async function getPaginatedQuestionsFromDB(
  params: FilterParams & { page?: number; pageSize?: number }
): Promise<PaginatedQuestionsResult> {
  try {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const selectCols = params.onlySummary
      ? 'id, task_id, title, difficulty, points, tags'
      : '*';

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.difficulties && params.difficulties.length > 0) {
      whereClause += ` AND difficulty = ANY($${paramIndex})`;
      queryParams.push(params.difficulties);
      paramIndex++;
    }

    if (params.search && params.search.trim() !== '') {
      const term = `%${params.search.toLowerCase().trim()}%`;
      whereClause += ` AND (LOWER(title) LIKE $${paramIndex} OR id::text = $${paramIndex + 1})`;
      queryParams.push(term, params.search.trim());
      paramIndex += 2;
    }

    if (params.questionIds && params.questionIds.length > 0) {
      whereClause += ` AND id = ANY($${paramIndex})`;
      queryParams.push(params.questionIds);
      paramIndex++;
    }

    if (params.tags && params.tags.length > 0) {
      const tagPatterns = params.tags.map((t) => `%"${t}"%`);
      whereClause += ` AND (tags::text ILIKE ANY($${paramIndex}))`;
      queryParams.push(tagPatterns);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM questions ${whereClause}`;
    const dataQuery = `SELECT ${selectCols} FROM questions ${whereClause} ORDER BY id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataParams = [...queryParams, pageSize, offset];

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, queryParams),
      pool.query(dataQuery, dataParams),
    ]);

    const totalMatches = parseInt(countRes.rows[0]?.total || '0', 10);
    const questions = dataRes.rows.map(mapRowToQuestion);

    return { questions, totalMatches };
  } catch (error) {
    console.error('Error fetching paginated questions from Neon DB:', error);
    return { questions: [], totalMatches: 0 };
  }
}

export async function getRandomizedQuestionsFromDB(
  difficulties: Difficulty[],
  tags: string[],
  count: number,
  pointsConfig: PointsConfig
): Promise<Question[]> {
  try {
    const filtered = await filterQuestionsFromDB({ difficulties, tags, pointsConfig });
    if (filtered.length === 0) return [];

    // Fisher-Yates shuffle
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length));
  } catch (error) {
    console.error('Error getting randomized questions from Neon DB:', error);
    return [];
  }
}

export async function addQuestionToDB(questionData: {
  title: string;
  difficulty: Difficulty;
  tags: string[];
  problemDescription: string;
  starterCode?: string;
  entryPoint?: string;
  testCases?: Array<{ input: string; output: string }>;
  edgeCases?: Array<{ title: string; input: string; output: string; explanation?: string }>;
}): Promise<{ success: boolean; error?: string; question?: Question }> {
  try {
    const normTitle = questionData.title.trim().toLowerCase();
    const taskIdSlug = normTitle.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check duplicate in Neon PostgreSQL database
    const dupCheck = await pool.query(
      `SELECT id, title FROM questions WHERE LOWER(TRIM(title)) = $1 OR LOWER(TRIM(task_id)) = $2 LIMIT 1`,
      [normTitle, taskIdSlug]
    );

    if (dupCheck.rows.length > 0) {
      return {
        success: false,
        error: `The question "${questionData.title}" already exists in the online database. Duplicate questions are rejected.`,
      };
    }

    // Get next ID
    const maxIdRes = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM questions');
    const nextId = parseInt(maxIdRes.rows[0].next_id, 10);

    const pointsMap: Record<Difficulty, number> = {
      Easy: 100,
      Medium: 200,
      Hard: 400,
    };
    const points = pointsMap[questionData.difficulty] || 100;
    const starterCode =
      questionData.starterCode ||
      'class Solution:\n    def solve(self):\n        # Write solution here\n        pass';
    const entryPoint = questionData.entryPoint || 'Solution().solve';
    const inputOutput = questionData.testCases || [];

    const insertRes = await pool.query(
      `INSERT INTO questions (
        id, task_id, title, difficulty, points, tags, problem_description, starter_code, entry_point, input_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        nextId,
        taskIdSlug,
        questionData.title.trim(),
        questionData.difficulty,
        points,
        JSON.stringify(questionData.tags || []),
        questionData.problemDescription,
        starterCode,
        entryPoint,
        JSON.stringify(inputOutput),
      ]
    );

    const newQuestion = mapRowToQuestion(insertRes.rows[0]);
    return { success: true, question: newQuestion };
  } catch (error: any) {
    console.error('Error adding question to Neon DB:', error);
    return {
      success: false,
      error: error?.message || 'Failed to insert question into PostgreSQL database.',
    };
  }
}
