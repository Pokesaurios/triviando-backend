import { createQueue } from "./bullmq";

export const TIMERS_QUEUE_NAME = "timers";

const DISABLED = process.env.NODE_ENV === 'test' || !process.env.REDIS_URL;
export const timersQueue = DISABLED ? null : createQueue(TIMERS_QUEUE_NAME);

export async function scheduleTimerJob(jobId: string, name: string, delayMs: number, data: any) {
  if (DISABLED || !timersQueue) return;
  await timersQueue.add(name, data, {
    jobId,
    delay: delayMs,
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
  } as any);
}

export async function removeTimerJob(jobId: string) {
  if (DISABLED || !timersQueue) return;
  try {
    const job = await timersQueue.getJob(jobId);
    if (job) await job.remove();
  } catch {
    // ignore
  }
}
