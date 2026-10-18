export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface TestCase {
  input: string;
  output: string;
}

export interface Question {
  id: number;
  taskId: string;
  title: string;
  difficulty: Difficulty;
  points: number;
  tags: string[];
  problemDescription: string;
  starterCode: string;
  entryPoint: string;
  starterCodes?: Record<string, string>;
  inputOutput: TestCase[];
}

export interface PointsConfig {
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface OAFilterConfig {
  difficulties: Difficulty[];
  tags: string[];
  questionCount: number;
  mode: 'random' | 'manual';
  selectedQuestionIds: number[];
  timeLimitMinutes: number;
  pointsConfig: PointsConfig;
  title?: string;
  isPOTD?: boolean;
}

export interface Submission {
  code: string;
  language: string;
  submittedAt: string;
  status: 'draft' | 'submitted';
  score: number;
  testResults: Array<{
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
  }>;
}

export interface OASession {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  timeLimitMinutes: number;
  config: OAFilterConfig;
  questions: Question[];
  userEmail?: string;
  roomId?: string;
  contestId?: string;
  submissions: Record<number, Submission>; // questionId -> Submission
  totalScore: number;
  maxScore: number;
  status: 'in_progress' | 'completed';
}

export interface TagCount {
  name: string;
  count: number;
}

export interface DatasetStats {
  totalQuestions: number;
  difficultyCounts: Record<Difficulty, number>;
  tagCounts: TagCount[];
}
