import http from "http";
import app from "./app";
import { initSocketServer } from "./socket";
import dotenv from "dotenv";
dotenv.config();
import logger from "./utils/logger";
import mongoose from "mongoose";
import redisClient from "./config/redis";
import { startTimersWorker, stopTimersWorker } from "./queues/timers.worker";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = initSocketServer(server);
// Start distributed timers worker (no-op in tests)
const worker = startTimersWorker();

server.listen(PORT, () => {
  logger.info({ port: PORT }, `🚀 Server running`);
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  try { server.close(() => logger.info("HTTP server closed")); } catch {}
  try { (io as any)?.close?.(); } catch {}
  try { stopTimersWorker(); } catch {}
  try { mongoose.connection.close(false); } catch {}
  try { (redisClient as any)?.quit?.(); } catch {}
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));