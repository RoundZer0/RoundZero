import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRatingHistoryEntry {
  contestId: string;
  contestTitle: string;
  rank: number;
  oldRating: number;
  newRating: number;
  delta: number;
  date: Date;
}

export interface IUser extends Document {
  email: string;
  name?: string;
  username?: string;
  image?: string;
  bio?: string;
  credits: number;
  isUnlimited: boolean;
  unlimitedExpiry?: Date;
  launchUnlimitedExpiry?: Date;
  contributedCount: number;
  potdStreak: number;
  potdLastSolvedDate?: string;
  potdSolvedDates: string[];
  contestRating: number;
  highestRating: number;
  contestsAttended: number;
  ratingHistory: IRatingHistoryEntry[];
  duelWins: number;
  duelLosses: number;
  createdAt: Date;
  updatedAt: Date;
}

const RatingHistorySchema = new Schema<IRatingHistoryEntry>(
  {
    contestId: { type: String, required: true },
    contestTitle: { type: String, required: true },
    rank: { type: Number, required: true },
    oldRating: { type: Number, required: true },
    newRating: { type: Number, required: true },
    delta: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    image: { type: String },
    bio: { type: String, default: 'Building algorithmic fluency on RoundZero' },
    credits: { type: Number, default: 1 },
    isUnlimited: { type: Boolean, default: false },
    unlimitedExpiry: { type: Date },
    launchUnlimitedExpiry: { type: Date },
    contributedCount: { type: Number, default: 0 },
    potdStreak: { type: Number, default: 0 },
    potdLastSolvedDate: { type: String },
    potdSolvedDates: { type: [String], default: [] },
    contestRating: { type: Number, default: 1500, index: true },
    highestRating: { type: Number, default: 1500 },
    contestsAttended: { type: Number, default: 0 },
    ratingHistory: { type: [RatingHistorySchema], default: [] },
    duelWins: { type: Number, default: 0 },
    duelLosses: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
