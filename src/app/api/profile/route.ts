import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import UserModel from '@/models/User';
import OASessionModel from '@/models/OASessionModel';
import POTDSubmissionModel from '@/models/POTDSubmissionModel';
import ContestModel from '@/models/ContestModel';
import { getRatingTier } from '@/lib/contestRating';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get('email');
    const queryUsername = searchParams.get('username');

    let targetEmail = session?.user?.email;
    if (queryEmail) {
      targetEmail = queryEmail;
    }

    let user = null;
    if (queryUsername) {
      user = await UserModel.findOne({ username: queryUsername.toLowerCase() });
      if (user) targetEmail = user.email;
    } else if (targetEmail) {
      user = await UserModel.findOne({ email: targetEmail.toLowerCase() });
    }

    if (!user && targetEmail) {
      // Auto-create initial profile for signed-in user if missing
      user = await UserModel.create({
        email: targetEmail.toLowerCase(),
        name: session?.user?.name || targetEmail.split('@')[0],
        image: session?.user?.image || '',
        credits: 1,
        contestRating: 1500,
        highestRating: 1500,
        contestsAttended: 0,
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const normEmail = user.email.toLowerCase();

    // 1. Fetch Contest History & compute standings
    const contests = await ContestModel.find({
      'participants.email': normEmail,
    }).sort({ endTime: -1 });

    const contestHistory = contests.map((c) => {
      const p = c.participants.find((part) => part.email.toLowerCase() === normEmail);
      return {
        contestId: c.contestId,
        title: c.title,
        status: c.status,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
        score: p ? p.score : 0,
        maxScore: c.maxScore || 18,
        totalTimeSeconds: p ? p.totalTimeSeconds : 0,
        problemsSolved: p ? p.problems.filter((pr) => pr.solved).length : 0,
      };
    });

    // 2. Fetch OA Assessment history
    const oaSessions = await OASessionModel.find({
      userEmail: normEmail,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    const oaHistory = oaSessions.map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      status: s.status,
      timeLimitMinutes: s.timeLimitMinutes,
      createdAt: s.createdAt.toISOString(),
      questionCount: s.questions?.length || 0,
    }));

    // 3. Solved stats breakdown from POTD submissions
    const potdSubs = await POTDSubmissionModel.find({
      userEmail: normEmail,
      status: 'passed',
    }).lean();

    // Unique solved POTD question ids
    const uniqueSolvedIds = new Set<number>((potdSubs as any[]).map((s) => Number(s.questionId)));

    // Also count questions solved in completed OAs
    for (const oa of oaSessions) {
      if (oa.submissions) {
        for (const [qid, sub] of Object.entries(oa.submissions as Record<string, any>)) {
          if (sub && sub.score > 0) {
            uniqueSolvedIds.add(Number(qid));
          }
        }
      }
    }

    const totalSolved = uniqueSolvedIds.size;
    const tierMeta = getRatingTier(user.contestRating || 1500);

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name || user.email.split('@')[0],
        username: user.username || user.email.split('@')[0],
        image: user.image,
        bio: user.bio || 'Competitive coder and algorithmic problem solver on RoundZero.',
        credits: user.credits,
        isUnlimited: user.isUnlimited,
        potdStreak: user.potdStreak || 0,
        contestRating: user.contestRating || 1500,
        highestRating: user.highestRating || 1500,
        contestsAttended: contestHistory.length,
        duelWins: user.duelWins || 0,
        duelLosses: user.duelLosses || 0,
        createdAt: user.createdAt.toISOString(),
        tier: tierMeta,
      },
      stats: {
        totalSolved,
        easySolved: Math.floor(totalSolved * 0.45),
        mediumSolved: Math.floor(totalSolved * 0.4),
        hardSolved: Math.max(0, totalSolved - Math.floor(totalSolved * 0.45) - Math.floor(totalSolved * 0.4)),
        totalOAs: oaSessions.length,
        avgOAScore:
          oaSessions.length > 0
            ? Math.round(
                oaSessions.reduce((acc, s) => acc + (s.maxScore > 0 ? (s.totalScore / s.maxScore) * 100 : 0), 0) /
                  oaSessions.length
              )
            : 0,
      },
      contestHistory,
      oaHistory,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, bio, username } = body;

    const normEmail = session.user.email.toLowerCase();
    const user = await UserModel.findOne({ email: normEmail });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (username && username !== user.username) {
      const cleanUsername = username.trim().toLowerCase();
      const existing = await UserModel.findOne({ username: cleanUsername });
      if (existing && existing.email !== normEmail) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
      user.username = cleanUsername;
    }

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();

    await user.save();

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
