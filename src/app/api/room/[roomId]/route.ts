import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import RoomModel from '@/models/RoomModel';
import { getRandomizedQuestionsFromDB, filterQuestionsFromDB } from '@/lib/questions';
import { OASession, OAFilterConfig, Question } from '@/types/oa';
import { saveSessionServer } from '@/lib/sessionStore';
import { saveOASessionToDB, getUserFromDB, updateUserCreditStatusInDB, syncUserWithMongoDB } from '@/lib/dbServices';
import PaymentModel from '@/models/PaymentModel';
import UserModel from '@/models/User';

// GET /api/room/[roomId] — poll room state
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  await connectToDatabase();

  const room = await RoomModel.findOne({ roomId });
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    title: room.title,
    roomType: room.roomType || '1v1_duel',
    creatorEmail: room.creatorEmail,
    members: room.members,
    status: room.status,
    winnerEmail: room.winnerEmail,
    oaConfig: room.oaConfig,
    startedAt: room.startedAt,
  });
}

// POST /api/room/[roomId] — actions: save_config | add_members | start_oa | leave
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await connectToDatabase();
  const room = await RoomModel.findOne({ roomId });
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  // Toggle ready status for 1v1 duel
  if (action === 'toggle_ready') {
    const member = room.members.find(
      (m) => m.email.toLowerCase() === session.user!.email!.toLowerCase()
    );
    if (member) {
      member.isReady = !member.isReady;
      await room.save();
    }
    return NextResponse.json({ ok: true, members: room.members });
  }

  // Set room mode (1v1 duel vs group mock)
  if (action === 'set_room_type') {
    if (room.creatorEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Only creator can change duel mode.' }, { status: 403 });
    }
    room.roomType = body.roomType === 'group_mock' ? 'group_mock' : '1v1_duel';
    await room.save();
    return NextResponse.json({ ok: true, roomType: room.roomType });
  }

  // Forfeit duel when screen/fullscreen is exited
  if (action === 'forfeit_duel') {
    if (!room.winnerEmail) {
      const opponent = room.members.find(
        (m) => m.email.toLowerCase() !== session.user!.email!.toLowerCase()
      );
      if (opponent) {
        room.winnerEmail = opponent.email;
      }
      room.status = 'completed';

      try {
        const loserUser = await UserModel.findOne({ email: session.user.email.toLowerCase() });
        if (loserUser) {
          loserUser.duelLosses = (loserUser.duelLosses || 0) + 1;
          await loserUser.save();
        }
        if (opponent) {
          const winnerUser = await UserModel.findOne({ email: opponent.email.toLowerCase() });
          if (winnerUser) {
            winnerUser.duelWins = (winnerUser.duelWins || 0) + 1;
            await winnerUser.save();
          }
        }
      } catch (e) {
        console.error('Error handling forfeit_duel stats:', e);
      }
      await room.save();
    }
    return NextResponse.json({ ok: true, room, winnerEmail: room.winnerEmail, status: room.status });
  }

  // Live progress telemetry or finish duel
  if (action === 'update_progress' || action === 'finish_duel') {
    const { problemsSolved, totalScore, currentQuestionIndex, isFinished, solutionAccepted } = body;
    const member = room.members.find(
      (m) => m.email.toLowerCase() === session.user!.email!.toLowerCase()
    );
    if (member) {
      if (typeof problemsSolved === 'number') member.problemsSolved = problemsSolved;
      if (typeof totalScore === 'number') member.totalScore = totalScore;
      if (typeof currentQuestionIndex === 'number') member.currentQuestionIndex = currentQuestionIndex;
      if (solutionAccepted) member.problemsSolved = Math.max(member.problemsSolved || 0, 1);

      // In 1v1 duel, if solution is accepted or candidate finished, award victory if not already claimed
      const shouldFinishDuel = (action === 'finish_duel' || isFinished || solutionAccepted);
      if (shouldFinishDuel && !room.winnerEmail) {
        room.winnerEmail = session.user.email;
        room.status = 'completed';

        // Update winner and loser duel stats
        try {
          const winnerUser = await UserModel.findOne({ email: session.user.email.toLowerCase() });
          if (winnerUser) {
            winnerUser.duelWins = (winnerUser.duelWins || 0) + 1;
            await winnerUser.save();
          }
          const opponent = room.members.find(
            (m) => m.email.toLowerCase() !== session.user!.email!.toLowerCase()
          );
          if (opponent) {
            const loserUser = await UserModel.findOne({ email: opponent.email.toLowerCase() });
            if (loserUser) {
              loserUser.duelLosses = (loserUser.duelLosses || 0) + 1;
              await loserUser.save();
            }
          }
        } catch (e) {
          console.error('Error updating duel match win/loss:', e);
        }
      }
      await room.save();
    }
    return NextResponse.json({ ok: true, room, winnerEmail: room.winnerEmail, status: room.status });
  }

  // Only creator can configure / start
  if (action === 'add_members') {
    if (room.creatorEmail !== session.user.email) {
      return NextResponse.json({ error: 'Only the room creator can add people.' }, { status: 403 });
    }
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: 'People cannot be added after the OA has started.' }, { status: 400 });
    }

    const emails: unknown[] = Array.isArray(body.emails) ? body.emails : [];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const submittedEmails = emails
      .filter((email): email is string => typeof email === 'string')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const invalidEmails = submittedEmails.filter((email) => !emailPattern.test(email));

    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address${invalidEmails.length === 1 ? '' : 'es'}: ${invalidEmails.join(', ')}` },
        { status: 400 }
      );
    }

    const normalizedEmails = [...new Set(submittedEmails)];

    if (normalizedEmails.length === 0) {
      return NextResponse.json({ error: 'Enter at least one valid email address.' }, { status: 400 });
    }

    const existingEmails = new Set(room.members.map((member) => member.email.toLowerCase()));
    const newMembers = normalizedEmails
      .filter((email) => !existingEmails.has(email))
      .map((email) => ({
        email,
        name: email,
        joinedAt: new Date(),
      }));

    if (newMembers.length > 0) {
      room.members.push(...newMembers);
      await room.save();
    }

    return NextResponse.json({
      ok: true,
      added: newMembers.length,
      members: room.members,
    });
  }

  if (action === 'save_config') {
    if (room.creatorEmail !== session.user.email) {
      return NextResponse.json({ error: 'Only the room creator can update settings.' }, { status: 403 });
    }
    room.oaConfig = body.oaConfig;
    await room.save();
    return NextResponse.json({ ok: true });
  }

  if (action === 'start_oa') {
    if (room.creatorEmail !== session.user.email) {
      return NextResponse.json({ error: 'Only the room creator can start the OA.' }, { status: 403 });
    }
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: 'OA already started.' }, { status: 400 });
    }

    // Fetch latest user and credits from DB
    let user = await getUserFromDB(session.user.email);
    if (!user) {
      user = await syncUserWithMongoDB(session.user.email, session.user.name || undefined);
    }

    let hasUnlimited = !!(user?.isUnlimited && (!user.unlimitedExpiry || new Date(user.unlimitedExpiry).getTime() > Date.now()));

    if (!hasUnlimited) {
      try {
        const verifiedPayment = await PaymentModel.findOne({
          userEmail: session.user.email,
          status: 'verified',
          $or: [{ planId: /unlimited/ }, { credits: { $gte: 900 } }],
        }).sort({ createdAt: -1 });

        if (verifiedPayment) {
          const purchaseDate = new Date(verifiedPayment.createdAt);
          const expiry = new Date(purchaseDate);
          expiry.setMonth(expiry.getMonth() + 3);
          if (expiry.getTime() > Date.now()) {
            hasUnlimited = true;
            await updateUserCreditStatusInDB(session.user.email, {
              isUnlimited: true,
              unlimitedExpiry: expiry.toISOString(),
              credits: 999,
            });
            user = await getUserFromDB(session.user.email);
          }
        }
      } catch (err) {
        console.warn('Could not check verified payment in room route:', err);
      }
    }

    // Check if the creator has sufficient credits to start the OA
    if (user && !hasUnlimited && (user.credits ?? 1) <= 0) {
      return NextResponse.json(
        { error: 'You have 0 OA credits remaining. Purchase ₹99 Unlimited Pass or contribute 3 questions to unlock!' },
        { status: 402 }
      );
    }

    const config: OAFilterConfig = body.oaConfig || room.oaConfig;
    if (!config) {
      return NextResponse.json({ error: 'No OA configuration saved. Configure the assessment first.' }, { status: 400 });
    }

    // Pick questions (same set for all members)
    let selectedQuestions: Question[] = [];
    if (config.mode === 'manual' && config.selectedQuestionIds?.length > 0) {
      selectedQuestions = await filterQuestionsFromDB({
        questionIds: config.selectedQuestionIds,
        pointsConfig: config.pointsConfig,
      });
    } else {
      selectedQuestions = await getRandomizedQuestionsFromDB(
        config.difficulties,
        config.tags,
        config.questionCount,
        config.pointsConfig
      );
    }

    if (selectedQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions match the filters.' }, { status: 400 });
    }

    selectedQuestions = selectedQuestions.map((q) => ({
      ...q,
      points: config.pointsConfig ? config.pointsConfig[q.difficulty] || q.points : q.points,
    }));

    const maxScore = selectedQuestions.reduce((acc, q) => acc + q.points, 0);

    // Create one OA session per member and store sessionId on their member entry
    const now = new Date().toISOString();
    const updatedMembers = await Promise.all(
      room.members.map(async (member) => {
        const sessionId =
          Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

        const oaSession: OASession = {
          id: sessionId,
          title: config.title || `${room.title} — OA`,
          roomId: room.roomId,
          userEmail: member.email,
          createdAt: now,
          startedAt: now,
          timeLimitMinutes: config.timeLimitMinutes || 60,
          config,
          questions: selectedQuestions,
          submissions: {},
          totalScore: 0,
          maxScore,
          status: 'in_progress',
        };

        saveSessionServer(oaSession);
        await saveOASessionToDB(oaSession);

        // Create a plain object with member data plus sessionId
        return {
          email: member.email,
          name: member.name,
          joinedAt: member.joinedAt,
          sessionId
        };
      })
    );

    room.members = updatedMembers as any;
    room.status = 'active';
    room.startedAt = new Date();
    room.oaConfig = config;
    await room.save();

    // Deduct 1 credit from the creator's account for starting the OA (only if not unlimited)
    if (user && !hasUnlimited) {
      await updateUserCreditStatusInDB(session.user.email, { credits: Math.max(0, (user.credits ?? 1) - 1) });
    }

    return NextResponse.json({
      ok: true,
      members: room.members,
      status: room.status,
    });
  }

  if (action === 'leave') {
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: 'Cannot leave a room after it has started.' }, { status: 400 });
    }
    // Creator cannot leave (they must delete the room instead — for now just block)
    if (room.creatorEmail === session.user.email) {
      return NextResponse.json({ error: 'Room creator cannot leave. Close the room instead.' }, { status: 400 });
    }
    room.members = room.members.filter((m) => m.email !== session.user!.email) as any;
    await room.save();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
