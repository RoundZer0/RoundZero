import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoomMember {
  email: string;
  name?: string;
  image?: string;
  joinedAt: Date;
  sessionId?: string; // their personal OA session once started
  isReady?: boolean;
  problemsSolved?: number;
  totalScore?: number;
  currentQuestionIndex?: number;
}

export interface IRoom extends Document {
  roomId: string;
  inviteCode: string;
  creatorEmail: string;
  title: string;
  roomType: '1v1_duel' | 'group_mock';
  members: IRoomMember[];
  oaConfig?: any; // OAFilterConfig, set once creator locks in settings
  status: 'waiting' | 'active' | 'completed';
  winnerEmail?: string;
  createdAt: Date;
  startedAt?: Date;
}

const RoomMemberSchema = new Schema<IRoomMember>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String },
    image: { type: String },
    joinedAt: { type: Date, default: Date.now },
    sessionId: { type: String },
    isReady: { type: Boolean, default: false },
    problemsSolved: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    currentQuestionIndex: { type: Number, default: 0 },
  },
  { _id: false }
);

const RoomSchema: Schema<IRoom> = new Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    inviteCode: { type: String, unique: true, sparse: true, index: true, uppercase: true, trim: true },
    creatorEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
    title: { type: String, required: true },
    roomType: { type: String, enum: ['1v1_duel', 'group_mock'], default: '1v1_duel' },
    members: [RoomMemberSchema],
    oaConfig: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed'],
      default: 'waiting',
    },
    winnerEmail: { type: String },
    startedAt: { type: Date },
  },
  { timestamps: true }
);

const RoomModel: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);

export default RoomModel;
