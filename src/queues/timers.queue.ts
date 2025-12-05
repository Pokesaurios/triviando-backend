import { createQueue } from "./bullmq";

export const TIMERS_QUEUE_NAME = "timers";

const DISABLED = process.env.NODE_ENV === 'test' || !process.env.REDIS_URL;
export const timersQueue = DISABLED ? null : createQueue(TIMERS_QUEUE_NAME);
function normalizeJobId(jobId: string) {
  if (!jobId || typeof jobId !== 'string') return jobId;
  // Replace any character that is not alphanumeric, dash or underscore with '-'
  // This prevents characters like ':' '/' or spaces which BullMQ may reject.
  const safe = jobId.replace(/[^A-Za-z0-9_-]/g, '-');
  if (safe !== jobId) {
    try {
      // Lazy import logger to avoid circular deps at top-level
      const logger = require('../utils/logger').default;
      logger.warn({ originalJobId: jobId, safeJobId: safe }, 'Normalized jobId for BullMQ');
    } catch {}
  }
  return safe;
}

export async function scheduleTimerJob(jobId: string, name: string, delayMs: number, data: any) {
  if (DISABLED || !timersQueue) return;
  const safeId = normalizeJobId(jobId);
  await timersQueue.add(name, data, {
    jobId: safeId,
    delay: delayMs,
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
  } as any);
}

export async function removeTimerJob(jobId: string) {
  if (DISABLED || !timersQueue) return;
  try {
    const safeId = normalizeJobId(jobId);
    const job = await timersQueue.getJob(safeId);
    if (job) await job.remove();
  } catch {
    // ignore
  }
}
