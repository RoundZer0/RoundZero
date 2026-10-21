import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import ContestRegistrationModel from '@/models/ContestRegistrationModel';
import { getSaturdayContestWindow } from '@/lib/contest';

const VALID_YEARS = new Set(['1st year', '2nd year', '3rd year', '4th year', 'Graduated']);

function isValidText(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Authentication required. Please sign in to register.' },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ message: 'Invalid registration details.' }, { status: 400 });
    }

    const { name, email, college, year, reminders, contest } = body as Record<string, unknown>;
    const currentContestId = getSaturdayContestWindow().contestId;
    const contestId = contest === 'contest-1' ? currentContestId : contest;
    if (
      contestId !== currentContestId ||
      !isValidText(name, 2, 100) ||
      !isValidEmail(email) ||
      !isValidText(college, 2, 200) ||
      typeof year !== 'string' ||
      !VALID_YEARS.has(year) ||
      typeof reminders !== 'boolean'
    ) {
      return NextResponse.json({ message: 'Please provide valid registration details.' }, { status: 400 });
    }

    await connectToDatabase();
    await ContestRegistrationModel.findOneAndUpdate(
      { contestId, email: email.trim().toLowerCase() },
      {
        $set: {
          name: name.trim(),
          college: college.trim(),
          year,
          reminders,
        },
        $setOnInsert: {
          contestId,
          email: email.trim().toLowerCase(),
          registeredAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving contest registration:', error);
    return NextResponse.json({ message: 'Unable to save your registration right now.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    await connectToDatabase();
    const contestId = getSaturdayContestWindow().contestId;
    const registration = await ContestRegistrationModel.findOne({
      contestId,
      email: session.user.email.trim().toLowerCase(),
    })
      .select({ college: 1 })
      .lean();
    const registered = await ContestRegistrationModel.countDocuments({ contestId });
    return NextResponse.json({ registered, college: registration?.college || null, contestId });
  } catch (error) {
    console.error('Error loading contest registration count:', error);
    return NextResponse.json({ message: 'Unable to load registration count.' }, { status: 500 });
  }
}
