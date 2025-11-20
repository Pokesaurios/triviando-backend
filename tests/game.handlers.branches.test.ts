import { jest } from '@jest/globals';

function createFakeIO() {
  const io: any = { to: jest.fn(() => ({ emit: jest.fn() })) };
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

const Room = { findOne: jest.fn((q:any)=>({ lean: async () => ({ code:q.code, hostId:'host', triviaId:'t1', maxPlayers:4, status:'in-game', players:[{ userId:'u1', name:'Alice' }, { userId:'u2', name:'Bob' }] }) })), findOneAndUpdate: jest.fn(()=>({ exec: async ()=>({}) })) };
jest.mock('../src/models/room.model', () => ({ __esModule: true, Room }));

const Trivia = { findById: jest.fn(()=>({ lean: () => ({ _id:'t1', questions:[{ question:'Q', options:['a','b'], correctAnswer:'a', difficulty:'easy' }, { question:'T', options:['a','b'], correctAnswer:'a', difficulty:'easy' }] }) })) };
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia }));

const GameResult = { findOne: jest.fn(()=>Promise.resolve(null)), create: jest.fn(async()=>({})) };
jest.mock('../src/models/gameResult.model', () => ({ __esModule: true, GameResult }));

let mockState: any = null;
const getGameState = jest.fn(async ()=> mockState);
const saveGameState = jest.fn(async (_c:string, s:any)=> { mockState = JSON.parse(JSON.stringify(s)); });
const scheduleTimer = jest.fn((_k:string, fn:()=>void)=> fn());
const clearTimer = jest.fn();
const attemptFirstPress = jest.fn(async ()=> true);
const resetFirstPress = jest.fn(async ()=> {});
const dedupeEvent = jest.fn(async ()=> true);

jest.mock('../src/services/game.service', () => ({ __esModule: true,
  initGameState: jest.fn(),
  getGameState: (...a:any[]) => getGameState(...a),
  saveGameState: (...a:any[]) => saveGameState(...a),
  scheduleTimer: (...a:any[]) => scheduleTimer(...a),
  clearTimer: (...a:any[]) => clearTimer(...a),
  attemptFirstPress: (...a:any[]) => attemptFirstPress(...a),
  resetFirstPress: (...a:any[]) => resetFirstPress(...a),
  dedupeEvent: (...a:any[]) => dedupeEvent(...a),
  DEFAULT_QUESTION_READ_MS: 1,
  MIN_BUTTON_DELAY_MS: 0,
  MAX_BUTTON_DELAY_MS: 0,
  PRESS_WINDOW_MS: 1,
  ANSWER_TIMEOUT_MS: 5,
}));

import { registerGameHandlers } from '../src/socket/game.handlers';

describe('game.handlers branches', () => {
  beforeEach(() => { jest.clearAllMocks(); mockState = null; });

  it('round:buttonPress rejects stale round', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerGameHandlers(io as any, socket as any);
    mockState = { roomCode:'X', triviaId:'t1', status:'open', currentQuestionIndex:0, roundSequence: 2, scores:{}, blocked:{}, players:[{ userId:'u1', name:'Alice' }] };
    await socket.trigger('round:buttonPress', { code:'X', roundSequence: 1 }, (resp:any)=>{
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/stale/i);
    });
  });

  it('round:buttonPress rejects when user is blocked', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerGameHandlers(io as any, socket as any);
    mockState = { roomCode:'X', triviaId:'t1', status:'open', currentQuestionIndex:0, roundSequence: 3, scores:{}, blocked:{ u1: true }, players:[{ userId:'u1', name:'Alice' }, { userId:'u2', name:'Bob' }] };
    await socket.trigger('round:buttonPress', { code:'X', roundSequence: 3 }, (resp:any)=>{
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/bloqueado/i);
    });
  });

  it('round:buttonPress handles attemptFirstPress false', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerGameHandlers(io as any, socket as any);
    mockState = { roomCode:'X', triviaId:'t1', status:'open', currentQuestionIndex:0, roundSequence: 4, scores:{}, blocked:{}, players:[{ userId:'u1', name:'Alice' }, { userId:'u2', name:'Bob' }] };
    (attemptFirstPress as jest.Mock).mockResolvedValueOnce(false);
    await socket.trigger('round:buttonPress', { code:'X', roundSequence: 4 }, (resp:any)=>{
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/otro jugador/i);
    });
  });
});
