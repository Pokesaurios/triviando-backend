import dotenv from 'dotenv';
dotenv.config();

import { scheduleTimerJob } from '../src/queues/timers.queue';

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('Please set REDIS_URL env var (e.g. redis://localhost:6379)');
    process.exit(1);
  }

  console.log('Scheduling an answerTimeout job to run in 5 seconds...');
  const jobId = `manual-test-${Date.now()}`;
  await scheduleTimerJob(jobId, 'answerTimeout', 5000, { code: 'TESTROOM', roundSequence: 1, userId: null });
  console.log('Job scheduled with id', jobId);
  process.exit(0);
}

main().catch((e) => {
  console.error('Error scheduling job', e);
  process.exit(1);
});
