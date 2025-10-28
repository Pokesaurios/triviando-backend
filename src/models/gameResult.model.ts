import { Schema, model, Document } from "mongoose";

export interface GameResultDocument extends Document {
  roomCode: string;
  triviaId: Schema.Types.ObjectId;
  finishedAt: Date;
  scores: Map<string, number>;
  players: { userId: string; name: string; score: number }[];
  winner?: { userId: string; name: string; score: number };
}

const GameResultSchema = new Schema<GameResultDocument>(
  {
    roomCode: { type: String, required: true, index: true, unique: true },
    triviaId: { type: Schema.Types.ObjectId, ref: "Trivia", required: true },
    finishedAt: { type: Date, default: Date.now },
    scores: { type: Map, of: Number, required: true },
    players: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
    winner: {
      userId: String,
      name: String,
      score: Number,
    },
  },
  { timestamps: true }
);

export const GameResult = model<GameResultDocument>("GameResult", GameResultSchema);