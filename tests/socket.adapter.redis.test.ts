import { jest } from '@jest/globals';

describe('socket/index - Redis adapter configuration', () => {
  const realEnv = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...realEnv }; });
  afterAll(() => { process.env = realEnv; });

  it('configures redis adapter when REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const adapterSpy = jest.fn();
    const use = jest.fn();
    const on = jest.fn();
    const mockServerInstance: any = { adapter: adapterSpy, use, on };

    // Mock socket.io Server constructor
    jest.doMock('socket.io', () => ({ __esModule: true, Server: jest.fn(() => mockServerInstance) }));

    // Mock ioredis to have duplicate
    const duplicate = jest.fn(() => ({}));
    const RedisCtor = jest.fn(() => ({ duplicate }));
    jest.doMock('ioredis', () => ({ __esModule: true, default: RedisCtor }));

    // Mock createAdapter to be a simple function
    const createAdapter = jest.fn(() => ({} as any));
    jest.doMock('@socket.io/redis-adapter', () => ({ __esModule: true, createAdapter }));

    let initSocketServer: any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      initSocketServer = require('../src/socket').initSocketServer;
    });

    const fakeHttp: any = {};
    initSocketServer(fakeHttp);

    expect(RedisCtor).toHaveBeenCalledWith('redis://localhost:6379');
    expect(duplicate).toHaveBeenCalled();
    expect(createAdapter).toHaveBeenCalled();
    expect(adapterSpy).toHaveBeenCalled();
  });
});
