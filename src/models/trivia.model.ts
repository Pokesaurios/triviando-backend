import { Schema, model, Document } from "mongoose";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface TriviaDocument extends Document {
  topic: string;
  questions: Question[];
  creator?: Schema.Types.ObjectId;
}

const questionSchema = new Schema<Question>({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
});

const triviaSchema = new Schema<TriviaDocument>(
  {
    topic: { type: String, required: true },
    questions: [questionSchema],
    creator: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Trivia = model<TriviaDocument>("Trivia", triviaSchema);