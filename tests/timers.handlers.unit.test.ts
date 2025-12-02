import { jest } from '@jest/globals';

// Minimal fake IO capturing emits
function createFakeIO() {
  const events: any[] = [];
  const io: any = {
    to: jest.fn(() => ({ emit: jest.fn((evt: string, payload: any) => { events.push({ evt, payload }); }) })),
    events,
  };
  return io;
}

// Mocks for services used inside timers.handlers
let mockState: any = null;
const getGameState = jest.fn(async (_code: string) => mockState);
const saveGameState = jest.fn(async (_code: string, s: any) => { mockState = JSON.parse(JSON.stringify(s)); });
const clearAnswerWindow = jest.fn((s:any) => { delete s.answerWindowEndsAt; delete s.answerWindowStartedAt; });
const resetFirstPress = jest.fn(async () => {});
const scheduleTimer = jest.fn((_k:string, fn:()=>void, _d?:number) => { /* not used in these tests */ });

jest.mock('../src/services/game.service', () => ({ __esModule: true,
  getGameState: (...a:any[]) => getGameState(...a),
  saveGameState: (...a:any[]) => saveGameState(...a),
  clearAnswerWindow: (...a:any[]) => clearAnswerWindow(...a),
  resetFirstPress: (...a:any[]) => resetFirstPress(...a),
  scheduleTimer: (...a:any[]) => scheduleTimer(...a),
}));

// Mock redis module referenced in guards (not exercised here)
jest.mock('../src/config/redis', () => ({ __esModule: true, default: { get: jest.fn(), del: jest.fn() } }));

import { handleWinnerTimeoutSafe } from '../src/services/timers.handlers';

describe('timers.handlers - handleWinnerTimeoutSafe', () => {
  beforeEach(() => { jest.clearAllMocks(); mockState = null; });

  it('returns early if answer window not expired yet', async () => {
    const io = createFakeIO();
    mockState = {
      roomCode: 'X', triviaId: 't1', status: 'answering', roundSequence: 1,
      players: [{ userId: 'u1', name: 'A' }], scores: { u1: 0 },
      answerWindowEndsAt: Date.now() + 1000,
    };

    await handleWinnerTimeoutSafe(io as any, 'X', 1, 'u1');

    // No emissions and no state changes
    expect(io.events.length).toBe(0);
    expect(saveGameState).not.toHaveBeenCalled();
  });

  it('emits result and updates state when window expired', async () => {
    const io = createFakeIO();
    mockState = {
      roomCode: 'X', triviaId: 't1', status: 'answering', roundSequence: 2,
      players: [{ userId: 'u1', name: 'A' }, { userId: 'u2', name: 'B' }], scores: { u1: 0, u2: 0 },
      answerWindowEndsAt: Date.now() - 10,
    };

    // Do not execute the delayed startRoundOpenButtonAgain path
    const realSetTimeout = global.setTimeout;
    // @ts-ignore
    global.setTimeout = (fn: any, _ms?: any) => 0 as any;
    try {
      await handleWinnerTimeoutSafe(io as any, 'X', 2, 'u1');
    } finally {
      global.setTimeout = realSetTimeout;
    }

    // Should have emitted game:update and round:result for timeout
    expect(io.events.some(e => e.evt === 'game:update')).toBe(true);
    expect(io.events.some(e => e.evt === 'round:result')).toBe(true);
    expect(saveGameState).toHaveBeenCalled();
    expect(clearAnswerWindow).toHaveBeenCalled();
    expect(resetFirstPress).toHaveBeenCalled();
  });

  it('returns early on roundSequence mismatch or missing state', async () => {
    const io = createFakeIO();
    mockState = null; // missing state
    await handleWinnerTimeoutSafe(io as any, 'X', 99, 'u1');
    expect(io.events.length).toBe(0);

    mockState = { roomCode: 'X', triviaId: 't', status: 'answering', roundSequence: 1, players: [], scores: {} };
    await handleWinnerTimeoutSafe(io as any, 'X', 2, 'u1'); // mismatch
    expect(io.events.length).toBe(0);
  });
});
