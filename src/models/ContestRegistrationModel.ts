import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IContestRegistration extends Document {
  contestId: string;
  email: string;
  name: string;
  college: string;
  year: string;
  reminders: boolean;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContestRegistrationSchema = new Schema<IContestRegistration>(
  {
    contestId: { type: String, required: true, index: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    college: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    reminders: { type: Boolean, default: true },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ContestRegistrationSchema.index({ contestId: 1, email: 1 }, { unique: true });

const ContestRegistrationModel: Model<IContestRegistration> =
  mongoose.models.ContestRegistration ||
  mongoose.model<IContestRegistration>('ContestRegistration', ContestRegistrationSchema);

export default ContestRegistrationModel;
