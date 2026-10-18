import { connectToDatabase } from './mongodb';
import UserModel from '@/models/User';
import QuestionModel from '@/models/QuestionModel';
import OASessionModel from '@/models/OASessionModel';
import PaymentModel from '@/models/PaymentModel';
import { OASession } from '@/types/oa';

export function normalizeEmail(email?: string): string {
  return email ? email.trim().toLowerCase() : '';
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function emailQuery(email: string) {
  const norm = normalizeEmail(email);
  return {
    $or: [
      { email: norm },
      { email: { $regex: new RegExp(`^${escapeRegex(norm)}$`, 'i') } },
    ],
  };
}

export async function syncUserWithMongoDB(email: string, name?: string, image?: string) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const normEmail = normalizeEmail(email);
    if (!normEmail) return null;

    let user = await UserModel.findOne(emailQuery(normEmail));
    const defaultUsername = normEmail.split('@')[0].toLowerCase();
    if (!user) {
      user = await UserModel.create({
        email: normEmail,
        name: name || 'User',
        username: defaultUsername,
        image: image || '',
        credits: 1,
        isUnlimited: false,
        contributedCount: 0,
      });
      console.log('Created new MongoDB User:', normEmail);
    } else {
      let needsSave = false;
      // Ensure the email in DB is always standardized to lowercase
      if (user.email !== normEmail) {
        user.email = normEmail;
        needsSave = true;
      }
      if (!user.username) {
        user.username = defaultUsername;
        needsSave = true;
      }
      if (needsSave) {
        await user.save().catch(() => {});
      }
    }

    // Auto-heal unlimited pass if verified payment exists in PaymentModel
    if (!user.isUnlimited) {
      const verifiedPayment = await PaymentModel.findOne({
        userEmail: { $regex: new RegExp(`^${escapeRegex(normEmail)}$`, 'i') },
        status: 'verified',
        $or: [{ planId: /unlimited/ }, { credits: { $gte: 900 } }],
      }).sort({ createdAt: -1 });

      if (verifiedPayment) {
        const purchaseDate = new Date(verifiedPayment.createdAt);
        const expiry = new Date(purchaseDate);
        expiry.setMonth(expiry.getMonth() + 3);
        if (expiry.getTime() > Date.now()) {
          user.isUnlimited = true;
          user.unlimitedExpiry = expiry;
          user.credits = 999;
          await user.save();
          console.log('Auto-healed Unlimited Pass for user:', normEmail);
        }
      }
    }

    return user;
  } catch (err) {
    console.warn('MongoDB User sync warning:', err);
    return null;
  }
}

export async function getUserFromDB(email: string) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;
    const normEmail = normalizeEmail(email);
    if (!normEmail) return null;
    const user = await UserModel.findOne(emailQuery(normEmail));
    return user;
  } catch (err) {
    console.warn('MongoDB getUserFromDB warning:', err);
    return null;
  }
}

export async function updateUserCreditStatusInDB(
  email: string,
  updateData: {
    isUnlimited?: boolean;
    unlimitedExpiry?: string | Date;
    credits?: number;
    contributedCount?: number;
  }
) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const normEmail = normalizeEmail(email);
    if (!normEmail) return null;

    const user = await UserModel.findOneAndUpdate(
      emailQuery(normEmail),
      { $set: { ...updateData, email: normEmail } },
      { new: true, upsert: true }
    );
    return user;
  } catch (err) {
    console.warn('MongoDB updateUserCreditStatusInDB warning:', err);
    return null;
  }
}

export async function saveOASessionToDB(session: OASession, userEmail?: string) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const normEmail = userEmail ? normalizeEmail(userEmail) : '';

    const doc = await OASessionModel.findOneAndUpdate(
      { sessionId: session.id },
      {
        sessionId: session.id,
        userEmail: normEmail || session.userEmail,
        roomId: session.roomId,
        contestId: session.contestId,
        title: session.title,
        timeLimitMinutes: session.timeLimitMinutes,
        config: session.config,
        questions: session.questions,
        submissions: session.submissions,
        totalScore: session.totalScore,
        maxScore: session.maxScore,
        status: session.status,
        startedAt: new Date(session.startedAt),
        completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
      },
      { upsert: true, new: true }
    );
    return doc;
  } catch (err) {
    console.warn('MongoDB OA Session save warning:', err);
    return null;
  }
}

export async function getOASessionFromDB(sessionId: string) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const doc = await OASessionModel.findOne({ sessionId });
    if (!doc) return null;

    return {
      id: doc.sessionId,
      title: doc.title,
      roomId: doc.roomId,
      contestId: doc.contestId,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      startedAt: doc.startedAt ? doc.startedAt.toISOString() : new Date().toISOString(),
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined,
      timeLimitMinutes: doc.timeLimitMinutes,
      config: doc.config,
      questions: doc.questions,
      submissions: doc.submissions || {},
      totalScore: doc.totalScore,
      maxScore: doc.maxScore,
      status: doc.status,
    } as OASession;
  } catch (err) {
    console.warn('MongoDB OA Session fetch warning:', err);
    return null;
  }
}

export async function getUserOASessionsFromDB(email: string): Promise<OASession[]> {
  try {
    const conn = await connectToDatabase();
    if (!conn) return [];
    const normEmail = normalizeEmail(email);
    if (!normEmail) return [];

    const docs = await OASessionModel.find({
      userEmail: { $regex: new RegExp(`^${escapeRegex(normEmail)}$`, 'i') },
    }).sort({ createdAt: -1 });

    return docs.map((doc) => ({
      id: doc.sessionId,
      title: doc.title,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      startedAt: doc.startedAt ? doc.startedAt.toISOString() : new Date().toISOString(),
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined,
      timeLimitMinutes: doc.timeLimitMinutes,
      config: doc.config,
      questions: doc.questions,
      submissions: doc.submissions || {},
      totalScore: doc.totalScore,
      maxScore: doc.maxScore,
      status: doc.status,
    })) as OASession[];
  } catch (err) {
    console.warn('MongoDB getUserOASessionsFromDB warning:', err);
    return [];
  }
}

export async function getUserContributedQuestionsFromDB(email: string) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return [];
    const normEmail = normalizeEmail(email);
    if (!normEmail) return [];

    const docs = await QuestionModel.find({
      contributedBy: { $regex: new RegExp(`^${escapeRegex(normEmail)}$`, 'i') },
    }).sort({ createdAt: -1 });

    return docs.map((q) => ({
      id: String(q.questionId),
      title: q.title,
      difficulty: q.difficulty,
      tags: q.tags || [],
      problemDescription: q.problemDescription,
      testCases: q.inputOutput || [],
      edgeCases: q.edgeCases || [],
      starterCode: q.starterCode,
      submittedAt: q.createdAt ? q.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('MongoDB getUserContributedQuestionsFromDB warning:', err);
    return [];
  }
}

export async function recordPaymentToDB(data: {
  orderId: string;
  paymentId?: string;
  userEmail?: string;
  planId: string;
  amount: number;
  credits: number;
  status: 'created' | 'verified' | 'failed';
}) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const normEmail = data.userEmail ? normalizeEmail(data.userEmail) : undefined;

    const payment = await PaymentModel.findOneAndUpdate(
      { orderId: data.orderId },
      { ...data, userEmail: normEmail },
      { upsert: true, new: true }
    );
    return payment;
  } catch (err) {
    console.warn('MongoDB Payment record warning:', err);
    return null;
  }
}

export async function saveContributedQuestionToDB(question: {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  problemDescription: string;
  testCases: Array<{ input: string; output: string }>;
  edgeCases: Array<{ title: string; input: string; output: string; explanation?: string }>;
  starterCode?: string;
  contributedBy?: string;
}) {
  try {
    const conn = await connectToDatabase();
    if (!conn) return null;

    const maxQ = await QuestionModel.findOne().sort({ questionId: -1 });
    const nextId = (maxQ?.questionId || 3000) + 1;

    const qDoc = await QuestionModel.create({
      questionId: nextId,
      taskId: question.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: question.title,
      difficulty: question.difficulty,
      points: question.difficulty === 'Easy' ? 100 : question.difficulty === 'Medium' ? 200 : 400,
      tags: question.tags,
      problemDescription: question.problemDescription,
      starterCode: question.starterCode || '',
      inputOutput: question.testCases,
      edgeCases: question.edgeCases,
      isCommunity: true,
      contributedBy: question.contributedBy || 'Anonymous',
    });

    return qDoc;
  } catch (err) {
    console.warn('MongoDB Question save warning:', err);
    return null;
  }
}
