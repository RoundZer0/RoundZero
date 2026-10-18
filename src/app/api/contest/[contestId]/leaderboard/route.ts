import { NextRequest, NextResponse } from 'next/server';
import { getContestLeaderboard } from '@/lib/contest';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await params;
    const leaderboardData = await getContestLeaderboard(contestId);

    if (!leaderboardData) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
