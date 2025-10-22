import { Schema, model, Document, Types } from "mongoose";

interface Player {
  userId: Types.ObjectId;
  name: string;
  socketId?: string;
  joinedAt: Date;
}

export interface RoomDocument extends Document {
  code: string;
  hostId: Types.ObjectId;
  topic?: string;
  triviaId?: Types.ObjectId;
  status: "waiting" | "in-game" | "finished";
  maxPlayers: number;
  players: Player[];
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<Player>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  socketId: { type: String },
  joinedAt: { type: Date, default: () => new Date() },
});

const roomSchema = new Schema<RoomDocument>(
  {
    code: { type: String, required: true, unique: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String },
    triviaId: { type: Schema.Types.ObjectId, ref: "Trivia" },
    status: { type: String, enum: ["waiting", "in-game", "finished"], default: "waiting" },
    maxPlayers: { type: Number, default: 4 },
    players: [playerSchema],
  },
  { timestamps: true }
);

export const Room = model<RoomDocument>("Room", roomSchema);

export function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}