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
  triviaId: Types.ObjectId;
  status: "waiting" | "in-game" | "finished";
  maxPlayers: number;
  players: Player[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;

  // Métodos helper
  isFull(): boolean;
  hasPlayer(userId: Types.ObjectId): boolean;
}

const playerSchema = new Schema<Player>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    socketId: { type: String },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const roomSchema = new Schema<RoomDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true, // ✅ Esto ya define el índice único (no hace falta definir otro)
    },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    triviaId: { type: Schema.Types.ObjectId, ref: "Trivia", required: true },
    status: {
      type: String,
      enum: ["waiting", "in-game", "finished"],
      default: "waiting",
    },
    maxPlayers: { type: Number, default: 4, min: 2, max: 10 },
    players: { type: [playerSchema], default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      index: { expires: "0s" },
    },
  },
  { timestamps: true }
);

// ✅ Solo dejamos un índice, evitando duplicados
roomSchema.index({ status: 1 });

// ───────────────
// Métodos helper
// ───────────────
roomSchema.methods.isFull = function () {
  return this.players.length >= this.maxPlayers;
};

roomSchema.methods.hasPlayer = function (userId: Types.ObjectId) {
  return this.players.some((p: Player) => p.userId.equals(userId));
};

// ───────────────
// Funciones externas
// ───────────────
export function generateRoomCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateUniqueRoomCode(): Promise<string> {
  let code: string;
  let exists = true;
  do {
    code = generateRoomCode();
    exists = (await Room.exists({ code })) !== null;
  } while (exists);
  return code;
}

export const Room = model<RoomDocument>("Room", roomSchema);