import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import RoomModel from '@/models/RoomModel';
import { randomBytes, randomInt } from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

// POST /api/room/quick-match — match with an existing waiting player or enqueue
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userEmail = session.user.email.toLowerCase().trim();
  const userName = session.user.name || session.user.email;

  const db = await connectToDatabase();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  try {
    // 1. Look for an open 1v1 duel room waiting for an opponent
    const waitingRoom = await RoomModel.findOne({
      status: 'waiting',
      roomType: '1v1_duel',
      creatorEmail: { $ne: userEmail },
      'members.1': { $exists: false }, // only 1 member currently in room
      createdAt: { $gte: tenMinutesAgo },
    }).sort({ createdAt: 1 }); // match oldest waiting player first

    if (waitingRoom) {
      const alreadyMember = waitingRoom.members.some((m) => m.email.toLowerCase() === userEmail);
      if (!alreadyMember) {
        waitingRoom.members.push({
          email: userEmail,
          name: userName,
          joinedAt: new Date(),
          isReady: true,
        });
        await waitingRoom.save();
      }
      return NextResponse.json({
        matched: true,
        roomId: waitingRoom.roomId,
        message: 'Opponent matched!',
      });
    }

    // 2. Check if user already has an active waiting room
    const existingUserRoom = await RoomModel.findOne({
      status: 'waiting',
      roomType: '1v1_duel',
      creatorEmail: userEmail,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (existingUserRoom) {
      return NextResponse.json({
        matched: false,
        roomId: existingUserRoom.roomId,
        message: 'Waiting in matchmaking queue...',
      });
    }

    // 3. Create a new 1v1 duel room and enter queue
    const newRoomId = randomBytes(8).toString('hex');
    const inviteCode = generateCode();

    const newRoom = await RoomModel.create({
      roomId: newRoomId,
      inviteCode,
      creatorEmail: userEmail,
      title: '1v1 Quick Duel',
      roomType: '1v1_duel',
      members: [
        {
          email: userEmail,
          name: userName,
          joinedAt: new Date(),
          isReady: true,
        },
      ],
      status: 'waiting',
    });

    return NextResponse.json({
      matched: false,
      roomId: newRoom.roomId,
      message: 'Room created. Waiting for an opponent to join...',
    });
  } catch (error: any) {
    console.error('Error in /api/room/quick-match:', error);
    return NextResponse.json({ error: error?.message || 'Matchmaking error' }, { status: 500 });
  }
}
