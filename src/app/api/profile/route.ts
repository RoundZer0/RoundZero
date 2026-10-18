import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import UserModel from '@/models/User';
import OASessionModel from '@/models/OASessionModel';
import POTDSubmissionModel from '@/models/POTDSubmissionModel';
import ContestModel from '@/models/ContestModel';
import { getRatingTier } from '@/lib/contestRating';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get('email')?.trim();
    const queryUsername = (searchParams.get('username') || searchParams.get('u') || '').trim();

    let targetEmail = session?.user?.email;
    if (queryEmail) {
      targetEmail = queryEmail;
    }

    let user = null;
    if (queryUsername) {
      const cleanU = queryUsername.toLowerCase();

      // 1. Exact username match
      user = await UserModel.findOne({ username: cleanU });

      // 2. Email match (if query contains @)
      if (!user && cleanU.includes('@')) {
        user = await UserModel.findOne({ email: cleanU });
      }

      // 3. Email prefix match (e.g. rohankumar9aajps -> rohankumar9aajps@gmail.com)
      if (!user) {
        user = await UserModel.findOne({
          email: { $regex: new RegExp(`^${escapeRegex(cleanU)}@`, 'i') },
        });
      }

      // 4. Case-insensitive username match
      if (!user) {
        user = await UserModel.findOne({
          username: { $regex: new RegExp(`^${escapeRegex(cleanU)}$`, 'i') },
        });
      }

      if (user) {
        targetEmail = user.email;
        if (!user.username) {
          user.username = cleanU;
          await user.save().catch(() => {});
        }
      }
    } else if (targetEmail) {
      user = await UserModel.findOne({ email: targetEmail.toLowerCase() });
      if (user && !user.username) {
        user.username = targetEmail.split('@')[0].toLowerCase();
        await user.save().catch(() => {});
      }
    }

    if (!user && targetEmail) {
      // Auto-create initial profile for signed-in user if missing
      const defaultUsername = targetEmail.split('@')[0].toLowerCase();
      user = await UserModel.create({
        email: targetEmail.toLowerCase(),
        name: session?.user?.name || targetEmail.split('@')[0],
        username: defaultUsername,
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

    // 4. Aggregate 365-day submission calendar
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 380);
    oneYearAgo.setHours(0, 0, 0, 0);

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    const submissionCalendar: Record<string, number> = {};

    // A. POTD submissions in past 380 days (never future dates)
    const allUserPotdSubs = await POTDSubmissionModel.find({
      userEmail: normEmail,
      createdAt: { $gte: oneYearAgo, $lte: now },
    }).lean();

    for (const sub of allUserPotdSubs as any[]) {
      let dStr = sub.dateStr;
      if (!dStr && sub.createdAt) {
        const subDate = new Date(sub.createdAt);
        const y = subDate.getFullYear();
        const m = String(subDate.getMonth() + 1).padStart(2, '0');
        const d = String(subDate.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${d}`;
      }
      if (dStr && dStr <= todayStr) {
        submissionCalendar[dStr] = (submissionCalendar[dStr] || 0) + 1;
      }
    }

    // B. OA Sessions in past 380 days (never future dates)
    const allUserOAs = await OASessionModel.find({
      userEmail: normEmail,
      createdAt: { $gte: oneYearAgo, $lte: now },
    }).lean();

    for (const oa of allUserOAs as any[]) {
      if (oa.createdAt) {
        const oaDateObj = new Date(oa.createdAt);
        const y = oaDateObj.getFullYear();
        const m = String(oaDateObj.getMonth() + 1).padStart(2, '0');
        const d = String(oaDateObj.getDate()).padStart(2, '0');
        const oaDate = `${y}-${m}-${d}`;
        if (oaDate <= todayStr) {
          let count = 0;
          if (oa.submissions) {
            for (const s of Object.values(oa.submissions as Record<string, any>)) {
              if (s && s.status === 'submitted') count++;
            }
          }
          submissionCalendar[oaDate] = (submissionCalendar[oaDate] || 0) + Math.max(1, count);
        }
      }
    }

    // C. Contest submissions in past 380 days (strictly past/ended contests with actual solved problems)
    for (const c of contests) {
      const cStartTime = new Date(c.startTime);
      if (cStartTime >= oneYearAgo && cStartTime <= now) {
        const p = c.participants?.find((part: any) => part.email.toLowerCase() === normEmail);
        if (p) {
          const y = cStartTime.getFullYear();
          const m = String(cStartTime.getMonth() + 1).padStart(2, '0');
          const d = String(cStartTime.getDate()).padStart(2, '0');
          const cDate = `${y}-${m}-${d}`;
          if (cDate <= todayStr) {
            const solved = p.problems ? p.problems.filter((pr: any) => pr.solved).length : 0;
            if (solved > 0) {
              submissionCalendar[cDate] = (submissionCalendar[cDate] || 0) + solved;
            }
          }
        }
      }
    }

    // Compute maxStreak and currentStreak
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 365; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      if (submissionCalendar[k] && submissionCalendar[k] > 0) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    const todayKey = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    let currentStreakCount = 0;
    let checkDate = new Date(today);
    if (!submissionCalendar[todayKey] && submissionCalendar[yesterdayKey]) {
      checkDate = yesterday;
    }

    while (true) {
      const key = checkDate.toISOString().split('T')[0];
      if (submissionCalendar[key] && submissionCalendar[key] > 0) {
        currentStreakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const totalSubmissions = Object.values(submissionCalendar).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(submissionCalendar).length;

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
      heatmap: {
        calendar: submissionCalendar,
        totalSubmissions,
        activeDays,
        longestStreak: Math.max(maxStreak, user.potdStreak || 0),
        currentStreak: Math.max(currentStreakCount, user.potdStreak || 0),
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
