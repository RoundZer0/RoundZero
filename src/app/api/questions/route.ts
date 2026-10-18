import { NextRequest, NextResponse } from 'next/server';
import {
  getDatasetStatsFromDB,
  getPaginatedQuestionsFromDB,
  getRandomizedQuestionsFromDB,
  addQuestionToDB,
} from '@/lib/questions';
import { Difficulty } from '@/types/oa';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('mode');
    if (mode === 'stats') {
      const stats = await getDatasetStatsFromDB();
      return NextResponse.json(stats);
    }

    const difficultiesRaw = searchParams.get('difficulties');
    const tagsRaw = searchParams.get('tags');
    const search = searchParams.get('search') || '';
    const countStr = searchParams.get('count');
    const randomize = searchParams.get('randomize') === 'true';

    const difficulties = difficultiesRaw
      ? (difficultiesRaw.split(',').filter(Boolean) as Difficulty[])
      : [];
    const tags = tagsRaw ? tagsRaw.split(',').filter(Boolean) : [];
    const count = countStr ? parseInt(countStr, 10) : 20;

    if (randomize) {
      const pointsConfig = {
        Easy: parseInt(searchParams.get('easyPoints') || '100', 10),
        Medium: parseInt(searchParams.get('mediumPoints') || '200', 10),
        Hard: parseInt(searchParams.get('hardPoints') || '400', 10),
      };

      const randomized = await getRandomizedQuestionsFromDB(
        difficulties,
        tags,
        count,
        pointsConfig
      );
      return NextResponse.json({ questions: randomized, totalMatches: randomized.length });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const { questions: paginated, totalMatches } = await getPaginatedQuestionsFromDB({
      difficulties,
      tags,
      search,
      onlySummary: true,
      page,
      pageSize,
    });

    return NextResponse.json({
      questions: paginated,
      totalMatches,
      page,
      totalPages: Math.ceil(totalMatches / pageSize),
    });
  } catch (error: any) {
    console.error('Error in GET /api/questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, difficulty, problemDescription, tags, testCases, edgeCases, starterCode, entryPoint } = body;

    if (!title || !problemDescription || !difficulty) {
      return NextResponse.json(
        { error: 'Title, difficulty, and problem description are required.' },
        { status: 400 }
      );
    }

    const result = await addQuestionToDB({
      title,
      difficulty,
      tags: tags || [],
      problemDescription,
      starterCode,
      entryPoint,
      testCases,
      edgeCases,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: 'Question successfully added to database!',
        question: result.question,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/questions:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to add question to database.' },
      { status: 500 }
    );
  }
}
