import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { joinOrStartContest } from '@/lib/contest';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to enter the contest.' },
        { status: 401 }
      );
    }

    const result = await joinOrStartContest(contestId, {
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to join contest' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId });
  } catch (error) {
    console.error('Error joining contest:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
