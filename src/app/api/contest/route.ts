import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCurrentContest, getPastContests, getContestLeaderboard } from '@/lib/contest';
import ContestModel from '@/models/ContestModel';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const requestedContestId = searchParams.get('contestId');

    let contest;
    if (requestedContestId) {
      contest = await ContestModel.findOne({ contestId: requestedContestId });
    }
    if (!contest) {
      contest = await getOrCreateCurrentContest();
    }
    if (!contest) {
      return NextResponse.json({ error: 'Failed to load contest' }, { status: 500 });
    }

    const pastContests = await getPastContests(10);

    const now = Date.now();
    const startTime = new Date(contest.startTime).getTime();
    const endTime = new Date(contest.endTime).getTime();

    let countdownSeconds = 0;
    if (now < startTime) {
      countdownSeconds = Math.max(0, Math.floor((startTime - now) / 1000));
    } else if (now >= startTime && now <= endTime) {
      countdownSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
    }

    const isLive = now >= startTime && now <= endTime;
    const isEnded = now > endTime || contest.status === 'completed';
    const isQuestionsRevealed = isLive || isEnded;

    // NEVER expose question details (titles, tags, problem id) while contest is upcoming!
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

    const leaderboardData = await getContestLeaderboard(contest.contestId);

    return NextResponse.json({
      contest: {
        contestId: contest.contestId,
        contestNumber: contest.contestNumber,
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
      collegeRankings: leaderboardData?.collegeRankings || [],
      pastContests,
    });
  } catch (error) {
    console.error('Error fetching contest route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
