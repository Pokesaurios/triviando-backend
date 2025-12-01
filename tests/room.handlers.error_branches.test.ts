import { jest } from '@jest/globals';

// Mutable implementations that tests will override per-case
let roomFindOneImpl: (q?: any) => Promise<any> = async () => null;
let roomFindOneAndUpdateImpl: (q?: any, u?: any) => Promise<any> = async () => null;
let genQuestionsImpl: (topic: string, qty: number) => Promise<any[]> = async (t: string, q: number) => new Array(q).fill(0).map((_, i) => ({ question: `Q${i + 1}`, options: ['a', 'b', 'c', 'd'], correctAnswer: 'a', difficulty: 'easy' }));

// Hoisted mocks that reference the mutable implementations above
jest.mock('../src/models/room.model', () => ({
  __esModule: true,
  Room: class Room {
    doc: any;
    constructor(doc:any){ this.doc = doc; }
    async save(){ return { _id: 'r1', ...this.doc }; }
    static findOne(q: any){ return { lean: () => roomFindOneImpl(q) }; }
    static findOneAndUpdate(q: any, u: any){ return { lean: () => roomFindOneAndUpdateImpl(q, u) }; }
  },
  generateUniqueRoomCode: async () => 'CODE11',
}));

jest.mock('../src/services/aiGenerator.service', () => ({ __esModule: true, generateQuestions: (...a: any[]) => genQuestionsImpl(...a) }));

// Generic mocks for Trivia and User so handlers can import them
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia: class Trivia { constructor(_:any){} async save(){ return { _id:'t1' }; } static findById(){ return { lean: ()=> ({ _id:'t1', questions: [] }) }; } } }));
jest.mock('../src/models/user.model', () => ({ __esModule: true, default: { findById: (id:string) => ({ select: ()=> ({ lean: ()=> Promise.resolve({ _id:id, name:'Alice' }) }) }) } }));

import { registerRoomHandlers } from '../src/socket/room.handlers';

function createFakeIO() {
  const rooms: Record<string, { events: any[] }> = {};
  const io: any = {
    to: jest.fn((code: string) => {
      if (!rooms[code]) rooms[code] = { events: [] };
      return { emit: jest.fn((event: string, payload: any) => { rooms[code].events.push({ event, payload }); }) };
    }),
    emitted: rooms,
  };
  return io;
}

function createFakeSocket(user = { id: 'u1', name: 'Alice' }) {
  const handlers: Record<string, Function> = {};
  const socket: any = {
    data: { user },
    on: (evt: string, cb: Function) => { handlers[evt] = cb; },
    join: jest.fn(),
    emit: jest.fn(),
    trigger: async (evt: string, payload?: any, ack?: Function) => handlers[evt]?.(payload ?? {}, ack),
  };
  return socket;
}

// Mocks
const redisSetex = jest.fn();
jest.mock('../src/config/redis', () => ({ __esModule: true, default: { setex: (...a:any[])=>redisSetex(...a) } }));

const addChatMessage = jest.fn();
const getChatHistory = jest.fn(async (_code: string) => []);
jest.mock('../src/utils/redisChat', () => ({ __esModule: true, addChatMessage: (...a:any[])=>addChatMessage(...a), getChatHistory: (...a:any[])=>getChatHistory(...a) }));

// Room model mocks will be provided per-test via the hoisted mutable implementations above

describe('room.handlers error and edge branches', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('room:create handles generator errors and returns ack with error', async () => {
    // override generateQuestions to throw
    const genErr = jest.fn(async () => { throw new Error('AI error'); });
    genQuestionsImpl = genErr;

    roomFindOneImpl = async () => null;
    roomFindOneAndUpdateImpl = async () => null;

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name: 'Alice' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:create', { topic: 'sports', maxPlayers: 4, quantity: 5 }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.error).toMatch(/AI error/);
    });
  });

  it('room:join returns 403 when room is full (findOneAndUpdate null and room exists full)', async () => {
    // Room.findOneAndUpdate returns null
    // Make findOneAndUpdate return null and findOne return a full room
    roomFindOneAndUpdateImpl = async () => null;
    roomFindOneImpl = async () => ({ code: 'FULL01', players: [{ userId: 'a' }, { userId: 'b' }], maxPlayers: 2 });

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u3', name:'Charlie' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:join', { code: 'FULL01' }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.code).toBe(403);
      expect(resp.message).toMatch(/full or not found/i);
    });
  });

  it('room:chat handles addChatMessage errors and returns ack false', async () => {
    addChatMessage.mockImplementationOnce(()=>{ throw new Error('redis error'); });

    roomFindOneImpl = async () => null;
    roomFindOneAndUpdateImpl = async () => null;

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name: 'Alice' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:chat', { code: 'X', message: 'hello' }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.error).toMatch(/redis error/);
    });
  });

  it('room:reconnect returns not found when Room.findOne returns null', async () => {
    roomFindOneImpl = async () => null;

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name: 'Alice' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:reconnect', { code: 'NOROOM' }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/not found/i);
    });
  });

  it('disconnect without currentRoom does nothing', async () => {
    roomFindOneImpl = async () => null;

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name: 'Alice' });
    registerRoomHandlers(io as any, socket as any);

    // trigger disconnect before joining any room
    await socket.trigger('disconnect');

    expect(Object.keys((io as any).emitted).length).toBe(0);
  });

});
