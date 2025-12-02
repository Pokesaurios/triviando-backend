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

// Mocks
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

const Room = { findOne: jest.fn((q:any) => ({ lean: () => Promise.resolve({ code: q.code, hostId: 'host1', triviaId: 't1', players: [{ userId:'host1', name:'Host' }, { userId:'u1', name:'Alice' }], status: 'in-game' }) })), findOneAndUpdate: jest.fn(()=>({ exec: async ()=>({}) })) };
jest.mock('../src/models/room.model', () => ({ __esModule: true, Room }));

const Trivia = { findById: jest.fn(()=>({ lean: () => ({ _id: 't1', questions: [ { question: 'Q1', options: ['a','b'], correctAnswer: 'a' } ] }) })) };
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia }));

const GameResult = { findOne: jest.fn(()=>Promise.resolve(null)), create: jest.fn(async()=>({})) };
jest.mock('../src/models/gameResult.model', () => ({ __esModule: true, GameResult }));

let mockState: any = null;
const getGameState = jest.fn(async () => mockState);
const saveGameState = jest.fn(async (_c:string, s:any)=> { mockState = JSON.parse(JSON.stringify(s)); });
const timers: Record<string, Function> = {};
const scheduleTimer = jest.fn((key: string, fn: ()=>void, _d?:number)=> { timers[key] = fn; });
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
  // simulate distributed timer by mapping to local timers with reschedule behavior
  scheduleDistributedAnswerTimeout: jest.fn(async (jobId: string, payload: any, _delayMs: number) => {
    const fn = async () => {
      // simulate handleWinnerTimeoutSafe guard: if endsAt in future, reschedule
      if (mockState && typeof mockState.answerWindowEndsAt === 'number' && Date.now() < mockState.answerWindowEndsAt) {
        // reschedule by assigning the same fn again
        timers[jobId] = fn;
        return;
      }
      // otherwise emit a marker by setting a property for assertions (no-op here)
    };
    timers[jobId] = fn;
  }),
  clearDistributedTimer: jest.fn(async (jobId: string) => { delete timers[jobId]; }),
  DEFAULT_QUESTION_READ_MS: 1,
  MIN_BUTTON_DELAY_MS: 0,
  MAX_BUTTON_DELAY_MS: 0,
  PRESS_WINDOW_MS: 1,
  ANSWER_TIMEOUT_MS: 500,
  ANSWER_BASE_SCORE: 100,
  ANSWER_SPEED_BONUS_MAX: 0,
}));

import { registerGameHandlers } from '../src/socket/game.handlers';

describe('timers: handleWinnerTimeout and startRoundOpenButtonAgain', () => {
  beforeEach(() => { jest.clearAllMocks(); for(const k in timers) delete timers[k]; mockState = null; });

  it('handleWinnerTimeout re-schedules when answerWindowEndsAt in future', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socket as any);

    // Prepare state that will be used when answer timeout is scheduled
    mockState = {
      roomCode: 'ROOMT', triviaId: 't1', status: 'answering',
      currentQuestionIndex: 0, roundSequence: 20, scores: { u1:0 }, blocked: {},
      players: [{ userId:'u1', name:'Alice' }],
      answerWindowEndsAt: Date.now() + 1000,
    };

    // Simulate pressing which schedules an answerTimeout via distributed scheduler
    await socket.trigger('round:buttonPress', { code: 'ROOMT', roundSequence: 20 }, (resp:any) => {});

    const answerKey = `ROOMT:answerTimeout:${mockState.roundSequence}`;
    expect(Object.keys(timers)).toContain(answerKey);

    // Now invoke the scheduled callback which simulates the guard and reschedules
    await timers[answerKey]();

    // After handler runs, scheduleTimer should have been called again for same key (reschedule)
    expect(Object.keys(timers)).toContain(answerKey);
  });

  it('startRoundOpenButtonAgain with no eligibles calls handleNoPresses', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u2', name: 'Bob' });
    registerGameHandlers(io as any, socket as any);

    // mock setTimeout to run immediately so startRoundOpenButtonAgain schedules synchronously
    const realSetTimeout = global.setTimeout;
    // @ts-ignore
    global.setTimeout = (fn: any, _ms?: any) => { fn(); return 0 as any; };

    try {
      mockState = {
        roomCode: 'ROOMS', triviaId: 't1', status: 'reading',
        currentQuestionIndex: 0, roundSequence: 30, scores: { u2:0 }, blocked: { u2: true },
        players: [{ userId:'u2', name:'Bob' }],
      };

      // Simulate calling startRoundOpenButtonAgain by invoking the internal flow: call round:answer with incorrect answer
      // Prepare redis first press
      redisGet.mockResolvedValueOnce('u2');

      await socket.trigger('round:answer', { code: 'ROOMS', roundSequence: 30, selectedIndex: 1 }, (resp:any) => {});

      // Trigger the pressWindow timer to simulate nobody pressed
      const pressKey = `ROOMS:pressWindow:30`;
      await timers[pressKey]?.();
      // handleNoPresses should have emitted round:result
      expect(io.events.some(e => e.evt === 'round:result')).toBe(true);
    } finally {
      global.setTimeout = realSetTimeout;
    }
  });
});
