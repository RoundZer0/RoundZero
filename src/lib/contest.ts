import pool from '@/lib/db/postgres';
import { connectToDatabase } from '@/lib/mongodb';
import ContestModel, { IContest, IContestParticipant } from '@/models/ContestModel';
import ContestRegistrationModel from '@/models/ContestRegistrationModel';
import { Question } from '@/types/oa';
import { mapRowToQuestion } from '@/lib/questions';
import { OASession } from '@/types/oa';
import { saveSessionServer } from '@/lib/sessionStore';
import { saveOASessionToDB, normalizeEmail } from '@/lib/dbServices';

// IST is UTC + 5.5 hours (330 minutes)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface SaturdayContestWindow {
  startTime: Date;
  endTime: Date;
  contestId: string;
  slug: string;
  title: string;
  contestNumber: number;
  status: 'upcoming' | 'active' | 'completed';
}

/**
 * Computes the Saturday 9:00 PM - 10:30 PM IST contest window relative to `now`.
 */
export function getSaturdayContestWindow(referenceDate: Date = new Date()): SaturdayContestWindow {
  const istNow = new Date(referenceDate.getTime() + IST_OFFSET_MS);

  const currentDay = istNow.getUTCDay(); // 0 = Sun, 6 = Sat
  const currentHour = istNow.getUTCHours();
  const currentMinute = istNow.getUTCMinutes();

  let daysUntilSaturday = (6 - currentDay + 7) % 7;

  // If today is Saturday and past 10:30 PM (22:30 IST), target next Saturday
  if (daysUntilSaturday === 0) {
    const isPastEnd = currentHour > 22 || (currentHour === 22 && currentMinute >= 30);
    if (isPastEnd) {
      daysUntilSaturday = 7;
    }
  }

  const targetDate = new Date(istNow);
  targetDate.setUTCDate(targetDate.getUTCDate() + daysUntilSaturday);
  targetDate.setUTCHours(21, 0, 0, 0); // 9:00 PM IST

  const startTime = new Date(targetDate.getTime() - IST_OFFSET_MS);
  const endTime = new Date(startTime.getTime() + 90 * 60 * 1000); // 10:30 PM IST (90 mins)

  // Generate deterministic slug based on the Saturday date: YYYY-MM-DD
  const yyyy = targetDate.getUTCFullYear();
  const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const contestId = `weekly-contest-${dateStr}`;
  const slug = `weekly-${dateStr}`;

  // Sequential contest numbering:
  // Contest #1 begins on Saturday, October 24, 2026.
  // Each subsequent Saturday increments the contest sequence number by 1.
  const EPOCH_SATURDAY_UTC = Date.UTC(2026, 9, 24); // Month is 0-indexed: 9 = October
  const targetSaturdayUTC = Date.UTC(yyyy, targetDate.getUTCMonth(), targetDate.getUTCDate());
  const diffWeeks = Math.round((targetSaturdayUTC - EPOCH_SATURDAY_UTC) / (7 * 24 * 60 * 60 * 1000));
  const contestNumber = Math.max(1, 1 + diffWeeks);
  const title = `RoundZero Weekly Contest #${contestNumber}`;

  const nowTime = referenceDate.getTime();
  let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
  if (nowTime >= startTime.getTime() && nowTime <= endTime.getTime()) {
    status = 'active';
  } else if (nowTime > endTime.getTime()) {
    status = 'completed';
  }

  return {
    startTime,
    endTime,
    contestId,
    slug,
    title,
    contestNumber,
    status,
  };
}

/**
 * Picks 4 random questions:
 * 1 Easy (3 pts), 2 Medium (4 pts & 5 pts), 1 Hard (6 pts)
 * Total Max Score = 18 points
 */
export async function pickContestQuestions(): Promise<Question[]> {
  try {
    // 1 Easy (3 pts)
    const easyQuery = await pool.query(
      `SELECT * FROM questions WHERE difficulty = 'Easy' ORDER BY RANDOM() LIMIT 1`
    );

    // 2 distinct Medium (4 pts, 5 pts)
    const medQuery = await pool.query(
      `SELECT * FROM questions WHERE difficulty = 'Medium' ORDER BY RANDOM() LIMIT 2`
    );

    // 1 Hard (6 pts)
    const hardQuery = await pool.query(
      `SELECT * FROM questions WHERE difficulty = 'Hard' ORDER BY RANDOM() LIMIT 1`
    );

    const questions: Question[] = [];

    if (easyQuery.rows.length > 0) {
      const q = mapRowToQuestion(easyQuery.rows[0]);
      q.points = 3;
      questions.push(q);
    }

    if (medQuery.rows.length > 0) {
      const q1 = mapRowToQuestion(medQuery.rows[0]);
      q1.points = 4;
      questions.push(q1);
    }

    if (medQuery.rows.length > 1) {
      const q2 = mapRowToQuestion(medQuery.rows[1]);
      q2.points = 5;
      questions.push(q2);
    }

    if (hardQuery.rows.length > 0) {
      const q = mapRowToQuestion(hardQuery.rows[0]);
      q.points = 6;
      questions.push(q);
    }

    return questions;
  } catch (error) {
    console.error('Error picking contest questions from Postgres:', error);
    return [];
  }
}

/**
 * Gets or creates the weekly contest in MongoDB.
 */
export async function getOrCreateCurrentContest(): Promise<IContest | null> {
  await connectToDatabase();

  const window = getSaturdayContestWindow();
  let contest = await ContestModel.findOne({ contestId: window.contestId });

  const now = new Date();
  let currentStatus: 'upcoming' | 'active' | 'completed' = 'upcoming';
  if (now.getTime() >= window.startTime.getTime() && now.getTime() <= window.endTime.getTime()) {
    currentStatus = 'active';
  } else if (now.getTime() > window.endTime.getTime()) {
    currentStatus = 'completed';
  }

  if (!contest) {
    const questions = await pickContestQuestions();
    contest = await ContestModel.create({
      contestId: window.contestId,
      contestNumber: window.contestNumber,
      title: window.title,
      slug: window.slug,
      description: 'Weekly 90-minute competitive coding contest. 4 algorithmic challenges (3, 4, 5, 6 points). Real-time live ranking.',
      startTime: window.startTime,
      endTime: window.endTime,
      durationMinutes: 90,
      status: currentStatus,
      questions,
      maxScore: 18,
      participants: [],
    });
  } else {
    let changed = false;
    if (contest.status !== currentStatus) {
      contest.status = currentStatus;
      changed = true;
    }
    if (contest.title !== window.title) {
      contest.title = window.title;
      changed = true;
    }
    if (contest.contestNumber !== window.contestNumber) {
      contest.contestNumber = window.contestNumber;
      changed = true;
    }
    if (!contest.questions || contest.questions.length === 0) {
      contest.questions = await pickContestQuestions();
      contest.maxScore = 18;
      changed = true;
    }
    if (changed) {
      await contest.save();
    }
  }

  return contest;
}

/**
 * Registers or starts a user in the contest.
 * Returns the assessment sessionId so they can take the test.
 * Strictly enforces that entry is ONLY permitted when the contest is LIVE.
 */
export async function joinOrStartContest(
  contestId: string,
  user: { email: string; name?: string; image?: string }
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  await connectToDatabase();
  const contest = await ContestModel.findOne({ contestId });
  if (!contest) {
    return { ok: false, error: 'Contest not found' };
  }

  const now = Date.now();
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  const isLive = now >= start && now <= end;

  if (!isLive) {
    if (now < start) {
      return {
        ok: false,
        error: 'Contest has not started yet. Entry opens on Saturday at 9:00 PM IST.',
      };
    } else {
      return {
        ok: false,
        error: 'This contest has already ended.',
      };
    }
  }

  // Ensure questions are populated
  if (!contest.questions || contest.questions.length === 0) {
    contest.questions = await pickContestQuestions();
    await contest.save();
  }

  const normEmail = normalizeEmail(user.email);
  if (!normEmail) {
    return { ok: false, error: 'User email is required' };
  }

  let participant = contest.participants.find((p) => p.email === normEmail);

  if (!participant) {
    participant = {
      email: normEmail,
      name: user.name || normEmail.split('@')[0],
      image: user.image || '',
      registeredAt: new Date(),
      score: 0,
      totalTimeSeconds: 0,
      penaltySeconds: 0,
      problems: contest.questions.map((q) => ({
        questionId: q.id,
        solved: false,
        points: 0,
        attempts: 0,
      })),
    };
    contest.participants.push(participant);
    await contest.save();
  }

  // If candidate already has an active sessionId, reuse it
  if (participant.sessionId) {
    return { ok: true, sessionId: participant.sessionId };
  }

  // Provision new OA Session for this contestant
  const sessionId =
    'contest-' +
    Math.random().toString(36).substring(2, 9) +
    '-' +
    Date.now().toString(36);

  const nowIso = new Date().toISOString();

  const oaSession: OASession = {
    id: sessionId,
    title: contest.title,
    createdAt: nowIso,
    startedAt: nowIso,
    timeLimitMinutes: 90,
    config: {
      difficulties: ['Easy', 'Medium', 'Hard'],
      tags: [],
      questionCount: contest.questions.length,
      mode: 'manual',
      selectedQuestionIds: contest.questions.map((q) => q.id),
      timeLimitMinutes: 90,
      pointsConfig: { Easy: 3, Medium: 5, Hard: 6 },
      title: contest.title,
      isPOTD: false,
    },
    questions: contest.questions,
    submissions: {},
    totalScore: 0,
    maxScore: contest.maxScore || 18,
    status: 'in_progress',
    userEmail: normEmail,
  };

  // Flag session with contest identifier
  (oaSession.config as any).isContest = true;
  (oaSession.config as any).contestId = contest.contestId;

  saveSessionServer(oaSession);
  await saveOASessionToDB(oaSession, normEmail);

  participant.sessionId = sessionId;
  participant.startedAt = new Date();
  await contest.save();

  return { ok: true, sessionId };
}

/**
 * Updates a contestant's problem status and real-time score when they submit code.
 */
export async function recordContestSubmission(
  contestId: string,
  userEmail: string,
  questionId: number,
  passedAllTests: boolean,
  scoreAwarded: number,
  submittedAt: Date = new Date()
): Promise<void> {
  try {
    await connectToDatabase();
    const contest = await ContestModel.findOne({ contestId });
    if (!contest) return;

    const normEmail = normalizeEmail(userEmail);
    const participant = contest.participants.find((p) => p.email === normEmail);
    if (!participant) return;

    let problem = participant.problems.find((p) => p.questionId === Number(questionId));
    if (!problem) {
      problem = {
        questionId: Number(questionId),
        solved: false,
        points: 0,
        attempts: 0,
      };
      participant.problems.push(problem);
    }

    problem.attempts += 1;

    if (passedAllTests && !problem.solved) {
      problem.solved = true;
      problem.points = scoreAwarded;
      problem.solvedAt = submittedAt;

      // Calculate time taken from contest start (or participant start)
      const baseStart = participant.startedAt || contest.startTime || submittedAt;
      const secondsElapsed = Math.max(0, Math.floor((submittedAt.getTime() - new Date(baseStart).getTime()) / 1000));
      // Standard competitive penalty: 5 mins (300 secs) per failed attempt before solve
      const wrongTriesBeforeSolve = Math.max(0, problem.attempts - 1);
      const penalty = wrongTriesBeforeSolve * 300;

      participant.totalTimeSeconds += secondsElapsed + penalty;
      participant.penaltySeconds += penalty;
    }

    // Recalculate total score
    participant.score = participant.problems.reduce((sum, p) => sum + (p.solved ? p.points : 0), 0);
    participant.submittedAt = submittedAt;

    await contest.save();
  } catch (error) {
    console.warn('Error recording contest submission:', error);
  }
}

/**
 * Returns formatted leaderboard sorted by:
 * 1. Score DESC
 * 2. Total Time / Penalty ASC
 * 3. RegisteredAt ASC
 */
export async function getContestLeaderboard(contestId: string) {
  await connectToDatabase();
  const contest = await ContestModel.findOne({ contestId });
  if (!contest) return null;

  const sortedParticipants = [...contest.participants].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.totalTimeSeconds !== b.totalTimeSeconds) {
      return a.totalTimeSeconds - b.totalTimeSeconds;
    }
    return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
  });

  const ranked = sortedParticipants.map((p, index) => {
    const minutes = Math.floor(p.totalTimeSeconds / 60);
    const seconds = p.totalTimeSeconds % 60;
    const formattedTime = `${minutes}m ${seconds}s`;

    return {
      rank: index + 1,
      email: p.email,
      name: p.name || p.email.split('@')[0],
      image: p.image || '',
      score: p.score,
      maxScore: contest.maxScore || 18,
      totalTime: formattedTime,
      totalTimeSeconds: p.totalTimeSeconds,
      problems: p.problems.map((prob) => ({
        questionId: prob.questionId,
        solved: prob.solved,
        points: prob.points,
        attempts: prob.attempts,
        solvedAt: prob.solvedAt ? prob.solvedAt.toISOString() : null,
      })),
      registeredAt: p.registeredAt.toISOString(),
      startedAt: p.startedAt ? p.startedAt.toISOString() : null,
    };
  });

  const now = Date.now();
  const startTime = new Date(contest.startTime).getTime();
  const isQuestionsRevealed =
    contest.status === 'active' || contest.status === 'completed' || now >= startTime;
  const isEnded = now > new Date(contest.endTime).getTime() || contest.status === 'completed';

  const collegeRankings = isEnded
    ? await getCollegeRankings(contestId, contest.participants)
    : [];

  return {
    contestId: contest.contestId,
    contestNumber: contest.contestNumber,
    title: contest.title,
    status: contest.status,
    startTime: contest.startTime.toISOString(),
    endTime: contest.endTime.toISOString(),
    durationMinutes: contest.durationMinutes,
    maxScore: contest.maxScore || 18,
    isQuestionsRevealed,
    questions: (contest.questions || []).map((q: any, idx: number) => ({
      id: isQuestionsRevealed ? q.id : 0,
      title: isQuestionsRevealed ? q.title : `Problem ${idx + 1}`,
      difficulty: q.difficulty,
      points: q.points,
      tags: isQuestionsRevealed ? q.tags || [] : [],
      isLocked: !isQuestionsRevealed,
    })),
    leaderboard: ranked,
    totalParticipants: ranked.length,
    collegeRankings,
  };
}

interface CollegeRanking {
  rank: number;
  college: string;
  registeredCount: number;
  participantCount: number;
  totalScore: number;
  averageScore: number;
}

async function getCollegeRankings(
  contestId: string,
  participants: IContestParticipant[]
): Promise<CollegeRanking[]> {
  const registrations = await ContestRegistrationModel.find({ contestId })
    .select({ email: 1, college: 1 })
    .lean();
  const colleges = new Map<
    string,
    { college: string; registeredCount: number; participantEmails: Set<string> }
  >();

  for (const registration of registrations) {
    const college = registration.college.trim();
    const collegeKey = college.toLocaleLowerCase();
    const existing = colleges.get(collegeKey);
    if (existing) {
      existing.registeredCount += 1;
      existing.participantEmails.add(normalizeEmail(registration.email));
    } else {
      colleges.set(collegeKey, {
        college,
        registeredCount: 1,
        participantEmails: new Set([normalizeEmail(registration.email)]),
      });
    }
  }

  const participantByEmail = new Map(participants.map((participant) => [participant.email, participant]));
  const ranked = Array.from(colleges.values()).map((college) => {
    const collegeParticipants = Array.from(college.participantEmails)
      .map((email) => participantByEmail.get(email))
      .filter((participant): participant is IContestParticipant => Boolean(participant));
    const totalScore = collegeParticipants.reduce((sum, participant) => sum + participant.score, 0);

    return {
      ...college,
      participantCount: collegeParticipants.length,
      totalScore,
      averageScore: collegeParticipants.length > 0 ? totalScore / collegeParticipants.length : 0,
    };
  });

  ranked.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.participantCount !== a.participantCount) return b.participantCount - a.participantCount;
    return a.college.localeCompare(b.college);
  });

  return ranked.map((college, index) => ({
    rank: index + 1,
    college: college.college,
    registeredCount: college.registeredCount,
    participantCount: college.participantCount,
    totalScore: college.totalScore,
    averageScore: Number(college.averageScore.toFixed(2)),
  }));
}

/**
 * Fetches recent past contests for historical review.
 */
export async function getPastContests(limit: number = 10) {
  await connectToDatabase();
  const now = new Date();
  const contests = await ContestModel.find({
    $or: [{ status: 'completed' }, { endTime: { $lt: now } }],
  })
    .sort({ endTime: -1 })
    .limit(limit);

  return contests.map((c) => ({
    contestId: c.contestId,
    contestNumber: c.contestNumber,
    title: c.title,
    slug: c.slug,
    status: c.status,
    startTime: c.startTime.toISOString(),
    endTime: c.endTime.toISOString(),
    participantsCount: c.participants.length,
    topScore: c.participants.length > 0 ? Math.max(...c.participants.map((p) => p.score)) : 0,
    questionsCount: c.questions.length,
  }));
}
