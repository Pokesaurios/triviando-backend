import { Worker, bullConnection } from "./bullmq";
import { TIMERS_QUEUE_NAME } from "./timers.queue";
import { getIo } from "../socket/ioRef";
import { handleWinnerTimeoutSafe } from "../services/timers.handlers";
import logger from "../utils/logger";

let timersWorker: Worker | null = null;

export function startTimersWorker() {
  // Avoid starting in test to keep tests fast/clean
  if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) return null;
  if (timersWorker) return timersWorker;

  timersWorker = new Worker(
    TIMERS_QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing timer job');

      const io = getIo();
      if (!io) return;

      if (job.name === 'answerTimeout') {
        const { code, roundSequence, userId } = job.data || {};
        await handleWinnerTimeoutSafe(io, code, roundSequence, userId);
      }
    },
    bullConnection
  );

  logger.info("✅ Timers Worker iniciado correctamente");

  return timersWorker;
}

export async function stopTimersWorker() {
  if (timersWorker) {
    try {
      await timersWorker.close();
    } catch {}
    timersWorker = null;
  }
}
