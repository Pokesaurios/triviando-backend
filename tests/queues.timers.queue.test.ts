import { jest } from '@jest/globals';

describe('timers.queue helpers', () => {
  const realEnv = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...realEnv }; });
  afterAll(() => { process.env = realEnv; });

  it('no-ops when DISABLED (test env or missing REDIS_URL)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.REDIS_URL;
    let mod:any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require('../src/queues/timers.queue');
    });
    expect(mod.timersQueue).toBeNull();
    await expect(mod.scheduleTimerJob('id','name',100,{ a:1 })).resolves.toBeUndefined();
    await expect(mod.removeTimerJob('id')).resolves.toBeUndefined();
  });

  it('schedules and removes jobs when enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const add = jest.fn(async () => ({}));
    const getJob = jest.fn(async (id:string) => ({ id, remove: jest.fn(async()=>{}) }));

    jest.doMock('../src/queues/bullmq', () => ({ __esModule: true, createQueue: () => ({ add, getJob }) }));

    let mod:any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require('../src/queues/timers.queue');
    });
    expect(mod.timersQueue).toBeTruthy();
    await mod.scheduleTimerJob('job-1','answerTimeout',250,{ x: 1 });
    expect(add).toHaveBeenCalledWith('answerTimeout', { x:1 }, expect.objectContaining({ jobId: 'job-1', delay: 250 }));

    await mod.removeTimerJob('job-1');
    expect(getJob).toHaveBeenCalledWith('job-1');
  });
});
