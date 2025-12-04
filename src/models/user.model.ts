import mongoose, { Schema, Document, Types } from "mongoose";

export interface User extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    refreshTokens: {
      type: [String],
      default: []
    },
  },
  { timestamps: true }
);

export default mongoose.model<User>("User", userSchema);