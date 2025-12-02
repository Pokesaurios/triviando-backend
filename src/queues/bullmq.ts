import { Queue, Worker, QueueScheduler, JobsOptions, QueueEvents } from "bullmq";

export const bullConnection = { connection: { url: process.env.REDIS_URL! } } as const;

export function createScheduler(name: string) {
  return new QueueScheduler(name, bullConnection);
}

export function createQueue(name: string) {
  return new Queue(name, bullConnection);
}

export { Worker, JobsOptions, QueueEvents };
