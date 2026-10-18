import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOASession extends Document {
  sessionId: string;
  userEmail?: string;
  roomId?: string;
  contestId?: string;
  title: string;
  timeLimitMinutes: number;
  config: any;
  questions: any[];
  submissions: Record<string, any>;
  totalScore: number;
  maxScore: number;
  status: 'in_progress' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

const OASessionSchema: Schema<IOASession> = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, index: true },
    roomId: { type: String, index: true },
    contestId: { type: String, index: true },
    title: { type: String, required: true },
    timeLimitMinutes: { type: Number, default: 60 },
    config: { type: Schema.Types.Mixed },
    questions: [{ type: Schema.Types.Mixed }],
    submissions: { type: Schema.Types.Mixed, default: {} },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const OASessionModel: Model<IOASession> =
  mongoose.models.OASession || mongoose.model<IOASession>('OASession', OASessionSchema);

export default OASessionModel;
