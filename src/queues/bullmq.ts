import { Queue, Worker } from "bullmq";
import type { JobsOptions, QueueEvents } from "bullmq";

export const bullConnection = {
  connection: { url: process.env.REDIS_URL! }
} as const;

export function createQueue(name: string) {
  return new Queue(name, bullConnection);
}

export { Worker };
export type { JobsOptions, QueueEvents };