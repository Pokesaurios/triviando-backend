import { jest } from '@jest/globals';

// Mocks for redis
const redisGet = jest.fn(async (_k: string) => null);
jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => redisGet(...args),
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

// Mock GameResult model
const findOneMock = jest.fn();
const createMock = jest.fn();
jest.mock('../src/models/gameResult.model', () => ({
  __esModule: true,
  GameResult: { findOne: (...args: any[]) => findOneMock(...args), create: (...args: any[]) => createMock(...args) },
}));

// Mock game.service helpers
const getGameState = jest.fn();
const saveGameState = jest.fn();
const clearAnswerWindow = jest.fn();
const resetFirstPress = jest.fn();
const scheduleTimer = jest.fn();
jest.mock('../src/services/game.service', () => ({
  __esModule: true,
  getGameState: (...args: any[]) => getGameState(...args),
  saveGameState: (...args: any[]) => saveGameState(...args),
  clearAnswerWindow: (...args: any[]) => clearAnswerWindow(...args),
  resetFirstPress: (...args: any[]) => resetFirstPress(...args),
  scheduleTimer: (...args: any[]) => scheduleTimer(...args),
  PRESS_WINDOW_MS: 1000,
  DEFAULT_QUESTION_READ_MS: 200,
  MIN_BUTTON_DELAY_MS: 10,
  MAX_BUTTON_DELAY_MS: 10,
}));

import * as timers from '../src/services/timers.handlers';

jest.useFakeTimers();

describe('timers.handlers', () => {
  const code = 'ROOM1';
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const io = { to } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default getGameState
    getGameState.mockResolvedValue({
      triviaId: 't1',
      currentQuestionIndex: 0,
      players: [{ userId: 'u1', name: 'Alice' }],
      roundSequence: 0,
      scores: { u1: 0 },
    });
  });

  it('startRound emits showQuestion and schedules timers', async () => {
    // control randomness
    jest.spyOn(Math, 'random').mockReturnValue(0);

    await timers.startRound(io, code);

    expect(getGameState).toHaveBeenCalledWith(code);
    expect(saveGameState).toHaveBeenCalled();
    expect(to).toHaveBeenCalledWith(code);
    // 'round:showQuestion' emitted
    expect(emit).toHaveBeenCalledWith('round:showQuestion', expect.objectContaining({ questionText: 'Q1' }));
    // scheduleTimer should be called at least once for openButton
    expect(scheduleTimer).toHaveBeenCalled();
  });

  it('handleNoPresses emits result and later starts next round when more questions', async () => {
    await timers.handleNoPresses(io, code, 0);

    expect(emit).toHaveBeenCalledWith('round:result', expect.objectContaining({ correctAnswer: 'a' }));
    expect(saveGameState).toHaveBeenCalled();
  });

  it('endGame triggers tiebreaker when tie and spare exists', async () => {
    // Setup tie state
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      players: [{ userId: 'u1', name: 'A' }, { userId: 'u2', name: 'B' }],
      scores: { u1: 5, u2: 5 },
      currentQuestionIndex: 0,
      roundSequence: 3,
      tieBreakerPlayed: false,
    });

    (findOneMock as jest.Mock).mockResolvedValueOnce(null);

    const startSpy = jest.spyOn(timers as any, 'startRound').mockResolvedValue(undefined);

    await timers.endGame(io, code);

    expect(saveGameState).toHaveBeenCalled();
    // verify saved state indicates tieBreaker will be played and currentQuestionIndex moved to spare
    const savedState = (saveGameState as jest.Mock).mock.calls[0][1];
    expect(savedState.tieBreakerPlayed).toBe(true);
    expect(savedState.currentQuestionIndex).toBe(mockTrivia.questions.length - 1);
  });

  it('endGame saves GameResult and emits finished when no tiebreaker', async () => {
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      players: [{ userId: 'u1', name: 'A' }, { userId: 'u2', name: 'B' }],
      scores: { u1: 6, u2: 4 },
      currentQuestionIndex: 0,
      roundSequence: 4,
      tieBreakerPlayed: false,
    });
    (findOneMock as jest.Mock).mockResolvedValueOnce(null);
    (createMock as jest.Mock).mockResolvedValueOnce({});

    await timers.endGame(io, code);

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ roomCode: code, scores: expect.any(Object) }));
    expect(emit).toHaveBeenCalledWith('game:finished', expect.objectContaining({ scores: expect.any(Object) }));
  });

  it('handleWinnerTimeoutSafe returns early when no state', async () => {
    getGameState.mockResolvedValueOnce(null);
    await timers.handleWinnerTimeoutSafe(io as any, code, 1, 'u1');
    expect(saveGameState).not.toHaveBeenCalled();
  });

  it('handleWinnerTimeoutSafe returns early when answerWindow still open', async () => {
    getGameState.mockResolvedValueOnce({ roundSequence: 1, answerWindowEndsAt: Date.now() + 10000 });
    await timers.handleWinnerTimeoutSafe(io as any, code, 1, 'u1');
    expect(saveGameState).not.toHaveBeenCalled();
  });

  it('handleWinnerTimeoutSafe finalizes and reopens button -> no eligible triggers handleNoPresses', async () => {
    // initial state: single player who will be blocked
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      players: [{ userId: 'u1', name: 'Solo' }],
      roundSequence: 2,
      currentQuestionIndex: 0,
      scores: { u1: 0 },
    });

    // When startRoundOpenButtonAgain calls getGameState again, return state showing the player blocked
    getGameState.mockResolvedValue({
      triviaId: 't1',
      players: [{ userId: 'u1', name: 'Solo' }],
      blocked: { u1: true },
      roundSequence: 2,
      currentQuestionIndex: 0,
      scores: { u1: 0 },
    });

    await timers.handleWinnerTimeoutSafe(io as any, code, 2, 'u1');

    // finalizeResultState should have saved state and emitted result
    expect(saveGameState).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('round:result', expect.any(Object));

    // advance timers to trigger reopening which will call handleNoPresses (via mocked getGameState and redis)
    jest.advanceTimersByTime(1300);
    await Promise.resolve();

    // handleNoPresses should have emitted another round:result (reveal)
    expect(emit).toHaveBeenCalledWith('round:result', expect.objectContaining({ message: expect.any(String) }));
  });

  it('startRoundOpenButtonAgain opens when eligible players exist', async () => {
    getGameState.mockResolvedValueOnce({
      players: [{ userId: 'u1', name: 'A' }, { userId: 'u2', name: 'B' }],
      blocked: { u1: false, u2: false },
      roundSequence: 5,
      triviaId: 't1',
      scores: { u1: 0, u2: 0 },
    });

    await timers.startRoundOpenButtonAgain(io as any, code, 5);
    expect(saveGameState).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('round:openButton', expect.objectContaining({ roundSequence: 5 }));
    expect(scheduleTimer).toHaveBeenCalled();
  });

  it('openButton (startRoundOpenButtonAgain) schedules pressWindow and pressWindow handles no-press path', async () => {
    // prepare state and ensure redis returns no first press
    (redisGet as jest.Mock)?.mockResolvedValue(null);
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      currentQuestionIndex: 0,
      players: [{ userId: 'u1', name: 'A' }],
      blocked: { u1: false },
      roundSequence: 0,
      scores: { u1: 0 },
    });

    // call the exported opener which emits and schedules pressWindow
    await timers.startRoundOpenButtonAgain(io as any, code, 0);

    expect(resetFirstPress).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('round:openButton', expect.objectContaining({ pressWindowMs: expect.any(Number) }));

    // find pressWindow scheduled callback and execute it
    const pressCall = scheduleTimer.mock.calls.find(c => typeof c[0] === 'string' && c[0].includes(':pressWindow:'));
    expect(pressCall).toBeDefined();
    const pressCb = pressCall[1];

    // ensure getGameState will report still-open state when pressWindow callback runs
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      currentQuestionIndex: 0,
      players: [{ userId: 'u1', name: 'A' }],
      blocked: { u1: false },
      roundSequence: 0,
      status: 'open',
      scores: { u1: 0 },
    });

    await pressCb();

    // since redis returned null, handleNoPresses path should run and emit a round:result reveal
    expect(emit).toHaveBeenCalledWith('round:result', expect.objectContaining({ message: expect.any(String) }));
  });

  it('endGame returns early when GameResult already exists', async () => {
    getGameState.mockResolvedValueOnce({
      triviaId: 't1',
      players: [{ userId: 'u1', name: 'A' }],
      scores: { u1: 1 },
    });
    (findOneMock as jest.Mock).mockResolvedValueOnce({ _id: 'exists' });
    await timers.endGame(io as any, code);
    expect(createMock).not.toHaveBeenCalled();
  });
});
