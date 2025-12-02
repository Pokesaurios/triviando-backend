import { Queue, Worker } from "bullmq";
import type { JobsOptions, QueueEvents } from "bullmq";

const QueueScheduler: any = (require("bullmq") as any).QueueScheduler;

export const bullConnection = { connection: { url: process.env.REDIS_URL! } } as const;

export function createScheduler(name: string) {
  return new QueueScheduler(name, bullConnection);
}

export function createQueue(name: string) {
  return new Queue(name, bullConnection);
}

export { Worker };
export type { JobsOptions, QueueEvents };
