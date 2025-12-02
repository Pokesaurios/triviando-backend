import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import triviaRoutes from "./routes/trivia.routes";
import { errorHandler } from "./middleware/errorHandler";
import { setupSwagger } from "./config/swagger";
import roomRoutes from "./routes/room.routes";
import gameResultRoutes from "./routes/gameResult.routes";
import mongoose from "mongoose";
import redis from "./config/redis";

dotenv.config({ path: ".env" });

const app = express();
app.set('trust proxy', 1);

// Database connection
connectDB();

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : '*';
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health check routes
app.get("/", (_, res) => res.send("✅ TriviAndo API is running"));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try { await (redis as any).ping?.(); redisOk = true; } catch {}
  if (mongoOk && redisOk) return res.status(200).send("ready");
  return res.status(503).json({ mongoOk, redisOk });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/trivia", triviaRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/game-results", gameResultRoutes);

// Swagger docs
setupSwagger(app);

// Global error handler
app.use(errorHandler);

export default app;