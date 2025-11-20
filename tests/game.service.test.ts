import { jest } from '@jest/globals';

// In-memory redis mock
const store = new Map<string, string>();
const setSpy = jest.fn(async (k: string, v: string) => { store.set(k, v); });
const getSpy = jest.fn(async (k: string) => store.get(k) ?? null);
const delSpy = jest.fn(async (k: string) => { store.delete(k); });
const saddSpy = jest.fn(async (_k: string, _member: string) => 1);
const expireSpy = jest.fn(async (_k: string, _sec: number) => 1);
const incrSpy = jest.fn(async (_k: string) => 1);

jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    set: setSpy,
    get: getSpy,
    del: delSpy,
    sadd: saddSpy,
    expire: expireSpy,
    incr: incrSpy,
  },
}));

// Mock Trivia model
const mockTrivia = { _id: 't1', questions: [
  { question: 'Q1', options: ['a','b'], correctAnswer: 'a', difficulty: 'easy' },
  { question: 'Q2', options: ['c','d'], correctAnswer: 'c', difficulty: 'easy' },
]};

jest.mock('../src/models/trivia.model', () => ({
  __esModule: true,
  Trivia: { findById: jest.fn(() => ({ lean: () => mockTrivia })) },
}));

// Mock setNxPx helper
const setNxPxMock = jest.fn(async (_k: string, _v: string, _px: number) => 'OK');
jest.mock('../src/utils/redisHelpers', () => ({
  __esModule: true,
  setNxPx: (...args: any[]) => setNxPxMock(...args),
}));

import {
  initGameState,
  getGameState,
  saveGameState,
  scheduleTimer,
  clearTimer,
  attemptFirstPress,
  resetFirstPress,
  dedupeEvent,
} from '../src/services/game.service';

jest.useFakeTimers();

describe('game.service', () => {
  const keyFor = (code: string) => `room:${code}:game`;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
  });

  it('initGameState creates and persists initial state with scores map', async () => {
    const state = await initGameState('ABCD12', 't1', [
      { userId: 'u1', name: 'Alice' },
      { userId: 'u2', name: 'Bob' },
    ]);
    expect(state.roomCode).toBe('ABCD12');
    expect(state.scores).toEqual({ u1: 0, u2: 0 });
    expect(setSpy).toHaveBeenCalledWith(keyFor('ABCD12'), expect.any(String));

    const raw = await getGameState('ABCD12');
    expect(raw?.players.map(p => p.userId)).toEqual(['u1','u2']);
  });

  it('saveGameState overrides existing persisted state', async () => {
    await initGameState('ROOM1', 't1', [{ userId: 'u1', name: 'A' }]);
    const s = await getGameState('ROOM1');
    expect(s).not.toBeNull();
    if (s) {
      s.scores.u1 = 42;
      await saveGameState('ROOM1', s);
    }
    const after = await getGameState('ROOM1');
    expect(after?.scores.u1).toBe(42);
  });

  it('getGameState handles corrupted JSON, logs and deletes key returning null', async () => {
    const code = 'BROKEN';
    // simulate corrupt value
    store.set(keyFor(code), '{not-json');
    const res = await getGameState(code);
    expect(res).toBeNull();
    expect(delSpy).toHaveBeenCalledWith(keyFor(code));
    // also increments metric and sets expire
    expect(incrSpy).toHaveBeenCalled();
    expect(expireSpy).toHaveBeenCalled();
  });

  it('attemptFirstPress returns true only the first time within window; reset clears it', async () => {
    setNxPxMock.mockResolvedValueOnce('OK');
    const first = await attemptFirstPress('R', 'u1', 5000);
    expect(first).toBe(true);
    // second time returns not OK
    setNxPxMock.mockResolvedValueOnce(null as any);
    const second = await attemptFirstPress('R', 'u2', 5000);
    expect(second).toBe(false);

    await resetFirstPress('R');
    expect(delSpy).toHaveBeenCalledWith('room:R:firstPress');
  });

  it('dedupeEvent accepts first event and rejects duplicates, applies TTL', async () => {
    (saddSpy as jest.Mock).mockResolvedValueOnce(1);
    const first = await dedupeEvent('R2', 'evt-1', 5);
    expect(first).toBe(true);
    expect(expireSpy).toHaveBeenCalledWith('room:R2:eventIds', 5);

    (saddSpy as jest.Mock).mockResolvedValueOnce(0);
    const dup = await dedupeEvent('R2', 'evt-1', 5);
    expect(dup).toBe(false);
  });

  it('scheduleTimer clears existing keys and runs callback once; clearTimer cancels', async () => {
    const fn = jest.fn();
    scheduleTimer('k', fn, 1000);
    // schedule another with same key; should clear previous
    const fn2 = jest.fn();
    scheduleTimer('k', fn2, 1000);

    // run timers
    jest.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);

    const canceled = jest.fn();
    scheduleTimer('c', canceled, 1000);
    clearTimer('c');
    jest.advanceTimersByTime(1000);
    expect(canceled).not.toHaveBeenCalled();
  });
});
