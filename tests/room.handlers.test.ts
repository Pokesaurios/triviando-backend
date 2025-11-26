import { jest } from '@jest/globals';

// Helpers to build fake io/socket
function createFakeIO() {
  const rooms: Record<string, { events: any[] }> = {};
  const io: any = {
    to: jest.fn((code: string) => {
      if (!rooms[code]) rooms[code] = { events: [] };
      return {
        emit: jest.fn((event: string, payload: any) => {
          rooms[code].events.push({ event, payload });
        }),
      };
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

// Mock deps
const redisSetex = jest.fn();
const redisGet = jest.fn();
jest.mock('../src/config/redis', () => ({ __esModule: true, default: { setex: (...a:any[])=>redisSetex(...a), get: (...a:any[])=>redisGet(...a) } }));

const addChatMessage = jest.fn();
const getChatHistory = jest.fn(async (_code: string) => []);
jest.mock('../src/utils/redisChat', () => ({ __esModule: true, addChatMessage: (...a:any[])=>addChatMessage(...a), getChatHistory: (...a:any[])=>getChatHistory(...a) }));

const genQuestions = jest.fn(async (topic: string, qty: number) => new Array(qty).fill(0).map((_,i)=>({ question:`Q${i+1}`, options:['a','b','c','d'], correctAnswer: 'a', difficulty:'easy' })));
jest.mock('../src/services/aiGenerator.service', () => ({ __esModule: true, generateQuestions: (...a:any[]) => genQuestions(...a) }));

const getGameState = jest.fn(async (_code: string) => null);
jest.mock('../src/services/game.service', () => ({ __esModule: true, getGameState: (...a:any[])=>getGameState(...a) }));

// In-memory Room & Trivia & User mocks
let rooms: any[] = [];
let trivias: any[] = [];
let users: any[] = [{ _id: 'u1', name: 'Alice' }, { _id:'u2', name:'Bob' }];

const RoomMock = {
  findOne: jest.fn((q:any) => ({
    lean: () => Promise.resolve(rooms.find(r => r.code === q.code) || null),
  })),
  findOneAndUpdate: jest.fn((q:any, upd:any) => ({
    lean: async () => {
      const r = rooms.find(r => r.code === q.code);
      if (!r) return null;
      // handle join constraint
      if (q["players.userId"]?.$ne && r.players.some((p:any)=>p.userId.toString()===q["players.userId"].$ne)) return null;
      if (q.$expr && !(r.players.length < r.maxPlayers)) return null;
      const newPlayer = { ...upd.$push.players };
      r.players.push(newPlayer);
      return { ...r };
    },
    exec: async () => { /* not used here */ },
  })),
  exists: jest.fn(async (q:any) => rooms.some(r=>r.code===q.code) ? { _id:'1'} : null),
  create: jest.fn(async (doc:any) => { rooms.push(doc); return doc; }),
};

const generateUniqueRoomCode = jest.fn(async () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  do { code = [...Array(6)].map(()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join(''); } while (rooms.some(r=>r.code===code));
  return code;
});

jest.mock('../src/models/room.model', () => ({
  __esModule: true,
  Room: class Room {
    private doc: any;
    constructor(doc: any) { this.doc = doc; }
    async save() {
      const saved = { ...this.doc, _id: `room_${rooms.length+1}` };
      rooms.push(saved);
      return saved;
    }
    static findOne = RoomMock.findOne;
    static findOneAndUpdate = RoomMock.findOneAndUpdate;
    static exists = RoomMock.exists;
    static create = RoomMock.create;
  },
  generateUniqueRoomCode: (...a:any[]) => generateUniqueRoomCode(...a),
}));

const TriviaMock = {
  findById: jest.fn((id:string) => ({ lean: () => Promise.resolve(trivias.find(t=>t._id===id) || null) })),
};
jest.mock('../src/models/trivia.model', () => ({ __esModule: true, Trivia: class Trivia {
  topic: string; questions: any[]; creator?: string;
  constructor(doc: any) { this.topic = doc.topic; this.questions = doc.questions; this.creator = doc.creator; }
  async save() { const saved = { _id: `t${trivias.length+1}`, topic: this.topic, questions: this.questions, creator: this.creator }; trivias.push(saved); return saved; }
  static findById = TriviaMock.findById;
} }));

const UserMock = {
  findById: jest.fn((id:string) => ({ select: (_:string)=>({ lean: () => Promise.resolve(users.find(u=>u._id===id) || null) }) })),
};
jest.mock('../src/models/user.model', () => ({ __esModule: true, default: UserMock }));

import { registerRoomHandlers } from '../src/socket/room.handlers';

describe('room.handlers', () => {
  beforeEach(() => {
    rooms = [];
    trivias = [{ _id: 't1', topic:'sports', questions: [{ question:'X', options:['a','b','c','d'], correctAnswer:'a', difficulty:'easy' }] }];
    jest.clearAllMocks();
  });

  it('room:create validates input and creates room, caches state and emits update', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name:'Alice' });

    registerRoomHandlers(io as any, socket as any);

    // invalid topic
    await socket.trigger('room:create', { topic: '', maxPlayers: 4, quantity: 5 }, (resp:any) => {
      expect(resp.ok).toBe(false);
    });

    // valid
    await socket.trigger('room:create', { topic: 'sports', maxPlayers: 4, quantity: 5 }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.room.players[0]).toMatchObject({ userId: 'u1', name: 'Alice' });
      expect(resp.room.chatHistory).toEqual([]);
    });

    // Ensure a room was created
    expect(rooms.length).toBe(1);
    const code = rooms[0].code;
    // cache setex called
    expect(redisSetex).toHaveBeenCalledWith(`room:${code}:state`, expect.any(Number), expect.any(String));
    // broadcast roomCreated
    expect(io.to).toHaveBeenCalledWith(code);
  });

  it('room:join adds player and emits playerJoined, or re-joins if already present', async () => {
    // setup a room
    rooms.push({ code:'ABCD12', hostId:'u1', triviaId:'t1', maxPlayers:4, status:'waiting', players:[{ userId:'u1', name:'Alice', joinedAt:new Date() }] });

    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u2', name:'Bob' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:join', { code: 'ABCD12' }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.room.players.some((p:any)=>p.userId==='u2')).toBe(true);
    });

    // already joined branch
    const socket2 = createFakeSocket({ id:'u2', name:'Bob' });
    registerRoomHandlers(io as any, socket2 as any);
    await socket2.trigger('room:join', { code: 'ABCD12' }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.room.players.length).toBe(2);
    });
  });

  it('room:chat validates and broadcasts new messages', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerRoomHandlers(io as any, socket as any);

    // invalid empty
    await socket.trigger('room:chat', { code: 'ABCD12', message: '   ' }, (resp:any)=>{
      expect(resp.ok).toBe(false);
    });

    await socket.trigger('room:chat', { code: 'ABCD12', message: 'hola!' }, (resp:any)=>{
      expect(resp.ok).toBe(true);
    });
    expect(addChatMessage).toHaveBeenCalled();
  });

  it('room:reconnect returns players and gameState snapshot', async () => {
    rooms.push({ code:'XYZ987', hostId:'u1', triviaId:'t1', maxPlayers:4, status:'waiting', players:[{ userId:'u1', name:'Alice', joinedAt:new Date() }] });
    getGameState.mockResolvedValueOnce({ foo: 'bar' });
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:reconnect', { code:'XYZ987' }, (resp:any) => {
      expect(resp.ok).toBe(true);
      expect(resp.room.players[0]).toMatchObject({ userId: 'u1', name: 'Alice' });
      expect(resp.room.gameState).toEqual({ foo: 'bar' });
    });
  });

  it('disconnect notifies room:update playerLeft', async () => {
    rooms.push({ code:'ROOMX', hostId:'u1', triviaId:'t1', maxPlayers:4, status:'waiting', players:[{ userId:'u1', name:'Alice', joinedAt:new Date() }] });
    const io = createFakeIO();
    const socket = createFakeSocket({ id:'u1', name:'Alice' });
    registerRoomHandlers(io as any, socket as any);

    // join first to set currentRoom
    await socket.trigger('room:join', { code:'ROOMX' }, ()=>{});

    // trigger disconnect event on socket
    await socket.trigger('disconnect');

    // assert event recorded in io.emitted for the room
    const roomEvents = (io as any).emitted['ROOMX']?.events || [];
    expect(roomEvents.some((e:any) => e.event === 'room:update' && e.payload?.event === 'playerLeft' && e.payload?.userId === 'u1')).toBe(true);
  });
});
