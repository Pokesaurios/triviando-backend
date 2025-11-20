import { jest } from '@jest/globals';

// Fake IO/Socket helpers
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

// ------- Mocks for dependencies -------
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

// Room model
const Room = {
  findOne: jest.fn((q:any) => ({ lean: () => Promise.resolve(q.code === 'ROOM' ? {
    code: 'ROOM', hostId: 'host1', triviaId: 'trivia1', maxPlayers: 4,
    status: 'waiting', players: [{ userId: 'host1', name: 'Host' }, { userId: 'u1', name: 'Alice' }, { userId: 'u2', name: 'Bob' }],
  } : null) })),
  findOneAndUpdate: jest.fn((_q:any, _upd:any) => ({ exec: async () => ({}) })),
};
jest.mock('../src/models/room.model', () => ({ __esModule: true, Room }));

// Trivia model
const triviaDoc = { _id: 'trivia1', questions: [
  { question: 'Q1', options: ['a','b','c','d'], correctAnswer: 'a', difficulty: 'easy' },
  { question: 'Q2', options: ['a','b','c','d'], correctAnswer: 'b', difficulty: 'easy' },
]};
const Trivia = { findById: jest.fn((id:string) => ({ lean: () => Promise.resolve(id ? triviaDoc : null) })) };
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia }));

// GameResult model
const GameResult = {
  findOne: jest.fn((_q:any) => Promise.resolve(null)),
  create: jest.fn(async (_doc:any) => ({})),
};
jest.mock('../src/models/gameResult.model', () => ({ __esModule: true, GameResult }));

// service functions and constants
const initGameState = jest.fn(async () => ({}));
let mockState: any = null;
const getGameState = jest.fn(async (_code: string) => mockState);
const saveGameState = jest.fn(async (_code: string, s: any) => { mockState = JSON.parse(JSON.stringify(s)); });
const scheduleTimer = jest.fn((_key: string, fn: () => void, _delay: number) => { fn(); });
const clearTimer = jest.fn((_key: string) => {});
const attemptFirstPress = jest.fn(async (_code: string, _userId: string) => true);
const resetFirstPress = jest.fn(async () => {});
const dedupeEvent = jest.fn(async () => true);

jest.mock('../src/services/game.service', () => ({ __esModule: true,
  initGameState: (...a:any[]) => initGameState(...a),
  getGameState: (...a:any[]) => getGameState(...a),
  saveGameState: (...a:any[]) => saveGameState(...a),
  scheduleTimer: (...a:any[]) => scheduleTimer(...a),
  clearTimer: (...a:any[]) => clearTimer(...a),
  attemptFirstPress: (...a:any[]) => attemptFirstPress(...a),
  resetFirstPress: (...a:any[]) => resetFirstPress(...a),
  dedupeEvent: (...a:any[]) => dedupeEvent(...a),
  DEFAULT_QUESTION_READ_MS: 1000,
  MIN_BUTTON_DELAY_MS: 10,
  MAX_BUTTON_DELAY_MS: 10,
  PRESS_WINDOW_MS: 1000,
  ANSWER_TIMEOUT_MS: 500,
}));

import { registerGameHandlers } from '../src/socket/game.handlers';

describe('game.handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = null;
  });

  it('game:start only host can start; emits game:started on success', async () => {
    const io = createFakeIO();
    const socketNonHost = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socketNonHost as any);

    await socketNonHost.trigger('game:start', { code: 'ROOM' }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/Only host/i);
    });

    const socketHost = createFakeSocket({ id: 'host1', name: 'Host' });
    registerGameHandlers(io as any, socketHost as any);

    // Prepare initial state returned after init
    mockState = {
      roomCode: 'ROOM', triviaId: 'trivia1', status: 'in-game',
      currentQuestionIndex: 0, roundSequence: 0, scores: { host1:0, u1:0, u2:0 }, blocked: {},
      players: [{ userId:'host1', name:'Host' },{ userId:'u1', name:'Alice' },{ userId:'u2', name:'Bob' }],
    };

    await socketHost.trigger('game:start', { code: 'ROOM' }, (resp:any) => {
      expect(resp.ok).toBe(true);
    });

    // Should have emitted game:started
    expect(io.events.some(e => e.evt === 'game:started' && e.payload.totalQuestions === 1)).toBe(true);
    // startRound should have tried to write game:update reading state
    expect(saveGameState).toHaveBeenCalled();
  });

  it('round:buttonPress accepts first press, transitions to answering and requests answer', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerGameHandlers(io as any, socket as any);

    mockState = {
      roomCode: 'ROOM', triviaId: 'trivia1', status: 'open',
      currentQuestionIndex: 0, roundSequence: 1, scores: { u1:0, u2:0 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' },{ userId:'u2', name:'Bob' }],
    };

    await socket.trigger('round:buttonPress', { code: 'ROOM', roundSequence: 1, eventId: 'e1' }, (resp:any)=>{
      expect(resp.ok).toBe(true);
    });

    // socket should receive answerRequest
    expect(socket.emit).toHaveBeenCalledWith('round:answerRequest', expect.objectContaining({ roundSequence: 1 }));
    // state should be answering
    expect(mockState.status).toBe('answering');
  });

  it('round:answer correct increases score and ends game when last question reached', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerGameHandlers(io as any, socket as any);

    // Prepare state so that after answering correctly currentQuestionIndex becomes 1 (last index)
    mockState = {
      roomCode: 'ROOM', triviaId: 'trivia1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 2, scores: { u1:0, u2:0 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' },{ userId:'u2', name:'Bob' }],
    };

    // Winner must match firstPress in redis
    redisGet.mockResolvedValueOnce('u1');
    await socket.trigger('round:answer', { code:'ROOM', roundSequence: 2, selectedIndex: 0, eventId: 'evt-ans' }, (resp:any)=>{
      expect(resp.ok).toBe(true);
      expect(resp.correct).toBe(true);
    });

    // score increased
    expect(mockState.scores.u1).toBeGreaterThan(0);
    // endGame flow should emit game:ended eventually (triggered inside code)
    expect(io.events.some(e => e.evt === 'game:ended')).toBe(true);
  });

  it('round:answer incorrect blocks player and reopens button (schedules)', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u2', name:'Bob' });
    registerGameHandlers(io as any, socket as any);

    mockState = {
      roomCode: 'ROOM', triviaId: 'trivia1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 3, scores: { u1:0, u2:0 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' },{ userId:'u2', name:'Bob' }],
    };

    // must match firstPress
    redisGet.mockResolvedValueOnce('u2');
    await socket.trigger('round:answer', { code:'ROOM', roundSequence: 3, selectedIndex: 1, eventId: 'evt-ans2' }, (resp:any)=>{
      expect(resp.ok).toBe(true);
      expect(resp.correct).toBe(false);
    });

    // should have scheduled reopen and marked player as blocked
    expect(mockState.blocked['u2']).toBe(true);
    expect(resetFirstPress).toHaveBeenCalled();
  });
});
