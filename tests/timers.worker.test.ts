import { jest } from '@jest/globals';

describe('timers.worker start/stop in test env', () => {
  const realEnv = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...realEnv, NODE_ENV: 'test' }; });
  afterAll(() => { process.env = realEnv; });

  it('startTimersWorker returns null and stopTimersWorker is safe', async () => {
    let api: any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      api = require('../src/queues/timers.worker');
    });
    const w = api.startTimersWorker();
    expect(w).toBeNull();
    await expect(api.stopTimersWorker()).resolves.toBeUndefined();
  });
});
