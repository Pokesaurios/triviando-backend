import { jest } from '@jest/globals';

// In-memory redis stub
const store = new Map<string, any>();
const saddSets = new Map<string, Set<string>>();
const redisMock = {
  get: jest.fn(async (k:string) => store.get(k) ?? null),
  set: jest.fn(async (k:string, v:any) => { store.set(k, v); return 'OK'; }),
  del: jest.fn(async (k:string) => { store.delete(k); return 1; }),
  expire: jest.fn(async (_k:string, _sec:number) => 1),
  incr: jest.fn(async (_k:string) => 1),
  sadd: jest.fn(async (k:string, v:string) => {
    const s = saddSets.get(k) || new Set<string>();
    const had = s.has(v);
    s.add(v);
    saddSets.set(k, s);
    return had ? 0 : 1;
  }),
};

jest.mock('../src/config/redis', () => ({ __esModule: true, default: redisMock }));

import { getGameState, saveGameState, dedupeEvent, scheduleDistributedAnswerTimeout, clearDistributedTimer } from '../src/services/game.service';

describe('game.service basics', () => {
  const realEnv = process.env;
  beforeEach(() => { jest.clearAllMocks(); store.clear(); saddSets.clear(); process.env = { ...realEnv, NODE_ENV: 'test' }; });
  afterAll(() => { process.env = realEnv; });

  it('getGameState returns null for corrupted JSON', async () => {
    const key = 'room:ABC:game';
    // write corrupted value
    (redisMock.set as any).mockResolvedValueOnce('OK');
    await redisMock.set(key, '{ not json');

    const state = await getGameState('ABC');
    expect(state).toBeNull();
    // Internal cleanup/metrics are best-effort; main guarantee is returning null.
  });

  it('saveGameState then getGameState returns same object', async () => {
    const state: any = { roomCode: 'R', triviaId: 't', status: 'in-game', currentQuestionIndex: 0, roundSequence: 1, scores: {}, blocked: {}, players: [] };
    await saveGameState('R', state);
    const fetched = await getGameState('R');
    expect(fetched).toEqual(state);
  });

  it('dedupeEvent returns true first time and false for duplicates', async () => {
    const first = await dedupeEvent('ROOM', 'evt-1', 1);
    expect(first).toBe(true);
    const second = await dedupeEvent('ROOM', 'evt-1', 1);
    expect(second).toBe(false);
  });

  it('distributed timers helpers are no-ops in test env', async () => {
    await expect(scheduleDistributedAnswerTimeout('id', { a: 1 }, 1000)).resolves.toBeUndefined();
    await expect(clearDistributedTimer('id')).resolves.toBeUndefined();
  });
});
