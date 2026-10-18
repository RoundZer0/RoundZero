import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ContestModel from '@/models/ContestModel';
import { getContestLeaderboard } from '@/lib/contest';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await params;
    await connectToDatabase();

    const contest = await ContestModel.findOne({ contestId });
    if (!contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    const now = Date.now();
    const startTime = new Date(contest.startTime).getTime();
    const endTime = new Date(contest.endTime).getTime();

    const isLive = now >= startTime && now <= endTime;
    const isEnded = now > endTime || contest.status === 'completed';
    const isQuestionsRevealed = isLive || isEnded;

    const safeQuestions = (contest.questions || []).map((q: any, idx: number) => {
      if (isQuestionsRevealed) {
        return {
          id: q.id,
          title: q.title,
          difficulty: q.difficulty,
          points: q.points,
          tags: q.tags || [],
          isLocked: false,
        };
      } else {
        return {
          id: 0,
          title: `Problem ${idx + 1}`,
          difficulty: q.difficulty,
          points: q.points,
          tags: [],
          isLocked: true,
        };
      }
    });

    const leaderboardData = await getContestLeaderboard(contestId);

    let countdownSeconds = 0;
    if (now < startTime) {
      countdownSeconds = Math.max(0, Math.floor((startTime - now) / 1000));
    } else if (now >= startTime && now <= endTime) {
      countdownSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
    }

    return NextResponse.json({
      contest: {
        contestId: contest.contestId,
        title: contest.title,
        slug: contest.slug,
        description: contest.description,
        startTime: contest.startTime.toISOString(),
        endTime: contest.endTime.toISOString(),
        durationMinutes: contest.durationMinutes,
        status: isEnded ? 'completed' : isLive ? 'active' : 'upcoming',
        maxScore: contest.maxScore || 18,
        questions: safeQuestions,
        isQuestionsRevealed,
        participantsCount: contest.participants?.length || 0,
        countdownSeconds,
        isLive,
        isEnded,
      },
      leaderboard: leaderboardData?.leaderboard || [],
    });
  } catch (error) {
    console.error('Error fetching specific contest route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
