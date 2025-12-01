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
  clearAnswerWindow,
} from '../src/services/game.service';

jest.useFakeTimers();

describe('game.service', () => {
  const keyFor = (code: string) => `room:${code}:game`;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
  });

  // ✅ initGameState OK
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

  // ✅ initGameState error branch
  it('initGameState throws if trivia is not found', async () => {
    const { Trivia } = require('../src/models/trivia.model');

    (Trivia.findById as jest.Mock).mockReturnValueOnce({
      lean: () => null,
    });

    await expect(
      initGameState('X1', 'bad-id', [])
    ).rejects.toThrow('Trivia not found');
  });

  // ✅ saveGameState
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

  // ✅ getGameState corrupt JSON
  it('getGameState handles corrupted JSON, logs and deletes key returning null', async () => {
    const code = 'BROKEN';
    store.set(keyFor(code), '{not-json');
    const res = await getGameState(code);
    expect(res).toBeNull();
    expect(delSpy).toHaveBeenCalledWith(keyFor(code));
    expect(incrSpy).toHaveBeenCalled();
    expect(expireSpy).toHaveBeenCalled();
  });

  // ✅ getGameState when incr fails
  it('getGameState continues even if metric incr fails', async () => {
    incrSpy.mockRejectedValueOnce(new Error('incr failed'));
    store.set(keyFor('BROKEN2'), '{bad-json');
    const res = await getGameState('BROKEN2');
    expect(res).toBeNull();
    expect(delSpy).toHaveBeenCalled();
  });

  // ✅ getGameState when expire fails
  it('getGameState continues even if expire fails', async () => {
    expireSpy.mockRejectedValueOnce(new Error('expire failed'));
    store.set(keyFor('BROKEN3'), '{bad-json');
    const res = await getGameState('BROKEN3');
    expect(res).toBeNull();
  });

  // ✅ getGameState when del fails
  it('getGameState continues even if delete fails', async () => {
    delSpy.mockRejectedValueOnce(new Error('delete failed'));
    store.set(keyFor('BROKEN4'), '{bad-json');
    const res = await getGameState('BROKEN4');
    expect(res).toBeNull();
  });

  // ✅ clearAnswerWindow
  it('clearAnswerWindow removes answerWindowEndsAt', () => {
    const state: any = { answerWindowEndsAt: 123 };
    clearAnswerWindow(state);
    expect(state.answerWindowEndsAt).toBeUndefined();
  });

  // ✅ attemptFirstPress + reset
  it('attemptFirstPress returns true only the first time within window; reset clears it', async () => {
    setNxPxMock.mockResolvedValueOnce('OK');
    const first = await attemptFirstPress('R', 'u1', 5000);
    expect(first).toBe(true);

    setNxPxMock.mockResolvedValueOnce(null as any);
    const second = await attemptFirstPress('R', 'u2', 5000);
    expect(second).toBe(false);

    await resetFirstPress('R');
    expect(delSpy).toHaveBeenCalledWith('room:R:firstPress');
  });

  // ✅ dedupeEvent normal + duplicate
  it('dedupeEvent accepts first event and rejects duplicates, applies TTL', async () => {
    (saddSpy as jest.Mock).mockResolvedValueOnce(1);
    const first = await dedupeEvent('R2', 'evt-1', 5);
    expect(first).toBe(true);
    expect(expireSpy).toHaveBeenCalledWith('room:R2:eventIds', 5);

    (saddSpy as jest.Mock).mockResolvedValueOnce(0);
    const dup = await dedupeEvent('R2', 'evt-1', 5);
    expect(dup).toBe(false);
  });

  // ✅ dedupeEvent early return
  it('dedupeEvent returns true if eventId is empty', async () => {
    const res = await dedupeEvent('R3', '', 5);
    expect(res).toBe(true);
  });

  // ✅ scheduleTimer + clearTimer + error branch
  it('scheduleTimer clears existing keys and runs callback once; clearTimer cancels', async () => {
    const fn = jest.fn();
    scheduleTimer('k', fn, 1000);

    const fn2 = jest.fn();
    scheduleTimer('k', fn2, 1000);

    jest.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);

    const canceled = jest.fn();
    scheduleTimer('c', canceled, 1000);
    clearTimer('c');
    jest.advanceTimersByTime(1000);
    expect(canceled).not.toHaveBeenCalled();
  });

  it('scheduleTimer catches and logs callback errors', async () => {
    const badFn = jest.fn(() => {
      throw new Error('boom');
    });

    scheduleTimer('err', badFn, 1000);
    jest.advanceTimersByTime(1000);

    expect(badFn).toHaveBeenCalled();
  });

  it('clearTimer does nothing if key does not exist', () => {
    clearTimer('nope');
    expect(true).toBe(true);
  });
});
