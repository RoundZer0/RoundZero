import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContestProblemStatus {
  questionId: number;
  solved: boolean;
  points: number;
  solvedAt?: Date;
  attempts: number;
}

export interface IContestParticipant {
  email: string;
  name: string;
  image?: string;
  registeredAt: Date;
  startedAt?: Date;
  submittedAt?: Date;
  sessionId?: string;
  score: number;
  totalTimeSeconds: number;
  penaltySeconds: number;
  problems: IContestProblemStatus[];
}

export interface IContest extends Document {
  contestId: string;
  contestNumber?: number;
  title: string;
  slug: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  status: 'upcoming' | 'active' | 'completed';
  questions: any[];
  maxScore: number;
  participants: IContestParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

const ContestProblemStatusSchema = new Schema<IContestProblemStatus>(
  {
    questionId: { type: Number, required: true },
    solved: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    solvedAt: { type: Date },
    attempts: { type: Number, default: 0 },
  },
  { _id: false }
);

const ContestParticipantSchema = new Schema<IContestParticipant>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    image: { type: String },
    registeredAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    submittedAt: { type: Date },
    sessionId: { type: String },
    score: { type: Number, default: 0 },
    totalTimeSeconds: { type: Number, default: 0 },
    penaltySeconds: { type: Number, default: 0 },
    problems: [ContestProblemStatusSchema],
  },
  { _id: false }
);

const ContestSchema: Schema<IContest> = new Schema(
  {
    contestId: { type: String, required: true, unique: true, index: true },
    contestNumber: { type: Number, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 90 },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed'],
      default: 'upcoming',
      index: true,
    },
    questions: [{ type: Schema.Types.Mixed }],
    maxScore: { type: Number, default: 18 },
    participants: [ContestParticipantSchema],
  },
  { timestamps: true }
);

const ContestModel: Model<IContest> =
  mongoose.models.Contest || mongoose.model<IContest>('Contest', ContestSchema);

export default ContestModel;
