import { jest } from '@jest/globals';

function createFakeIO() {
  const events: any[] = [];
  const io: any = {
    to: jest.fn(() => ({ emit: jest.fn((evt: string, payload: any) => { events.push({ evt, payload }); }) })),
    events,
  };
  return io;
}

function createFakeSocket(user = { id: 'u1', name: 'Alice' }) {
  const handlers: Record<string, Function> = {};
  const socket: any = {
    data: { user },
    on: (evt: string, cb: Function) => { handlers[evt] = cb; },
    emit: jest.fn(),
    trigger: async (evt: string, payload?: any, ack?: Function) => handlers[evt]?.(payload ?? {}, ack),
  };
  return socket;
}

// Common mocks for these tests
const redisGet = jest.fn();
const redisSet = jest.fn();
const redisDel = jest.fn();
const redisSAdd = jest.fn();
const redisExpire = jest.fn();
jest.mock('../src/config/redis', () => ({ __esModule: true, default: {
  get: (...a:any[]) => redisGet(...a),
  set: (...a:any[]) => redisSet(...a),
  del: (...a:any[]) => redisDel(...a),
  sadd: (...a:any[]) => redisSAdd(...a),
  expire: (...a:any[]) => redisExpire(...a),
} }));

// Models
const Room = { findOne: jest.fn((q:any) => ({ lean: () => Promise.resolve({ code: q.code, hostId: 'host1', triviaId: 't1', players: [{ userId:'host1', name:'Host' }, { userId:'u1', name:'Alice' }], status: 'in-game' }) })), findOneAndUpdate: jest.fn(()=>({ exec: async ()=>({}) })) };
jest.mock('../src/models/room.model', () => ({ __esModule: true, Room }));

// We'll vary trivia per test by mocking findById later where needed
const Trivia = { findById: jest.fn(() => ({ lean: () => ({ _id: 't1', questions: [{ question: 'Q', options: ['a','b'], correctAnswer: 'a' }] }) })) };
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia }));

const GameResult = { findOne: jest.fn(()=>Promise.resolve(null)), create: jest.fn(async()=>({})) };
jest.mock('../src/models/gameResult.model', () => ({ __esModule: true, GameResult }));

let mockState: any = null;
const getGameState = jest.fn(async () => mockState);
const saveGameState = jest.fn(async (_c:string, s:any)=> { mockState = JSON.parse(JSON.stringify(s)); });
const scheduleTimer = jest.fn((_k:string, fn:()=>void, _d?:number)=> fn());
const clearTimer = jest.fn();
const attemptFirstPress = jest.fn(async ()=> true);
const resetFirstPress = jest.fn(async ()=> {});
const dedupeEvent = jest.fn(async ()=> true);
const clearAnswerWindow = jest.fn();

jest.mock('../src/services/game.service', () => ({ __esModule: true,
  initGameState: jest.fn(),
  getGameState: (...a:any[]) => getGameState(...a),
  saveGameState: (...a:any[]) => saveGameState(...a),
  scheduleTimer: (...a:any[]) => scheduleTimer(...a),
  clearTimer: (...a:any[]) => clearTimer(...a),
  attemptFirstPress: (...a:any[]) => attemptFirstPress(...a),
  resetFirstPress: (...a:any[]) => resetFirstPress(...a),
  dedupeEvent: (...a:any[]) => dedupeEvent(...a),
  clearAnswerWindow: (...a:any[]) => clearAnswerWindow(...a),
  scheduleDistributedAnswerTimeout: jest.fn(async ()=>{}),
  clearDistributedTimer: jest.fn(async ()=>{}),
  DEFAULT_QUESTION_READ_MS: 1,
  MIN_BUTTON_DELAY_MS: 0,
  MAX_BUTTON_DELAY_MS: 0,
  PRESS_WINDOW_MS: 1,
  ANSWER_TIMEOUT_MS: 5,
  ANSWER_BASE_SCORE: 100,
  ANSWER_SPEED_BONUS_MAX: 0,
}));

import { registerGameHandlers } from '../src/socket/game.handlers';

describe('game.handlers endGame branches', () => {
  beforeEach(() => { jest.clearAllMocks(); mockState = null; });

  it('endGame returns early when GameResult already exists', async () => {
    // arrange
    (GameResult.findOne as jest.Mock).mockResolvedValueOnce({ id: 'existing' });
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socket as any);

    // Prepare a state so that after a correct answer endGame will be invoked
    mockState = {
      roomCode: 'ROOM', triviaId: 't1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 10, scores: { u1: 0, host1: 0 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' }, { userId:'host1', name:'Host' }],
    };

    // redis indicates u1 was first
    redisGet.mockResolvedValueOnce('u1');

    // Trigger correct answer (selectedIndex 0 -> correct)
    await socket.trigger('round:answer', { code: 'ROOM', roundSequence: 10, selectedIndex: 0 }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.correct).toBe(true);
    });

    // GameResult.create should NOT be called because findOne returned existing
    expect(GameResult.create).not.toHaveBeenCalled();
  });

  it('endGame handles tie by scheduling tie-breaker question', async () => {
    // arrange: two questions to have a spareIndex; ensure all Trivia.findById calls return this doc
    (Trivia.findById as jest.Mock).mockReturnValue({ lean: () => ({ _id: 't1', questions: [ { question: 'Q1', options: ['a','b'], correctAnswer: 'a' }, { question: 'QB', options: ['a','b'], correctAnswer: 'a' } ] }) });

    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socket as any);

    // Prepare state where after awarding 100 to u1 the top two will tie (host1 has 105, u1 has 5 -> u1 becomes 105)
    mockState = {
      roomCode: 'ROOMT', triviaId: 't1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 11, scores: { u1: 5, host1: 105 }, blocked: {}, tieBreakerPlayed: false,
      players: [{ userId:'u1', name:'Alice' }, { userId:'host1', name:'Host' }],
    };

    // redis indicates u1 was first
    redisGet.mockResolvedValueOnce('u1');

    // Trigger correct answer to cause endGame tie branch
    await socket.trigger('round:answer', { code: 'ROOMT', roundSequence: 11, selectedIndex: 0 }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.correct).toBe(true);
    });

    // After tie branch, tieBreakerPlayed should be true and currentQuestionIndex set to spare index (1)
    expect(mockState.tieBreakerPlayed).toBe(true);
    expect(mockState.currentQuestionIndex).toBe(1);
    // startRound should have been invoked which emits game:update
    expect(io.events.some(e => e.evt === 'game:update')).toBe(true);
  });

  it('endGame normal flow creates GameResult and emits game:ended', async () => {
    // arrange
    (Trivia.findById as jest.Mock).mockReturnValueOnce({ lean: () => ({ _id: 't1', questions: [ { question: 'Q1', options: ['a','b'], correctAnswer: 'a' } ] }) });
    (GameResult.findOne as jest.Mock).mockResolvedValueOnce(null);

    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socket as any);

    mockState = {
      roomCode: 'ROOMEND', triviaId: 't1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 12, scores: { u1: 20, host1: 10 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' }, { userId:'host1', name:'Host' }],
    };

    // redis indicates u1 was first
    redisGet.mockResolvedValueOnce('u1');

    await socket.trigger('round:answer', { code: 'ROOMEND', roundSequence: 12, selectedIndex: 0 }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.correct).toBe(true);
    });

    // Should have created a GameResult and emitted game:ended
    expect(GameResult.create).toHaveBeenCalled();
    expect(io.events.some(e => e.evt === 'game:ended')).toBe(true);
  });
});
