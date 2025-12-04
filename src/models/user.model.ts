import mongoose, { Schema, Document, Types } from "mongoose";

export interface User extends Document {
  _id: Types.ObjectId;
  username: string;
  name?: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    username: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const UserModel = mongoose.model<User>("User", userSchema);
export const User = UserModel;
export default UserModel;