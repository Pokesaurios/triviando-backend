import { jest } from '@jest/globals';
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
const redisGet = jest.fn();
jest.mock('../src/config/redis', () => ({ __esModule: true, default: { setex: (...a:any[])=>redisSetex(...a), get: (...a:any[])=>redisGet(...a) } }));

const addChatMessage = jest.fn();
const getChatHistory = jest.fn(async (_code: string) => []);
jest.mock('../src/utils/redisChat', () => ({ __esModule: true, addChatMessage: (...a:any[])=>addChatMessage(...a), getChatHistory: (...a:any[])=>getChatHistory(...a) }));

jest.mock('../src/services/aiGenerator.service', () => ({ __esModule: true, generateQuestions: jest.fn(async ()=>[]) }));

jest.mock('../src/models/room.model', () => ({ __esModule: true, Room: {
  findOne: jest.fn((_q:any) => ({ lean: async () => null })),
  findOneAndUpdate: jest.fn(() => ({ lean: async () => null })),
}, generateUniqueRoomCode: jest.fn(async ()=> 'ABCDEF') }));

jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia: class Trivia { constructor(_:any){} async save(){ return { _id:'t1' }; } static findById(){ return { lean: ()=> ({ _id:'t1', questions: [] }) }; } } }));

jest.mock('../src/models/user.model', () => ({ __esModule: true, default: { findById: (id:string) => ({ select: ()=> ({ lean: ()=> Promise.resolve({ _id:id, name:'Alice' }) }) }) } }));

describe('room.handlers branches', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('room:chat rejects overly long messages (>400 chars)', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerRoomHandlers(io as any, socket as any);

    const longMsg = 'x'.repeat(401);
    await socket.trigger('room:chat', { code: 'X', message: longMsg }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/too long/i);
    });
  });

  it('room:join fails when room not found', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:join', { code: 'NOPE' }, (resp:any) => {
      expect(resp.ok).toBe(false);
      expect(resp.message).toMatch(/not found/i);
    });
  });
});
