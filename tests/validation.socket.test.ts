import { jest } from '@jest/globals';

// reuse helpers from existing socket tests
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

import { registerRoomHandlers } from '../src/socket/room.handlers';
import { registerGameHandlers } from '../src/socket/game.handlers';

describe('Validation middleware - Socket', () => {
  it('should ack with code 400 for invalid room:join payload', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u2', name: 'Bob' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:join', { bad: 'payload' }, (resp: any) => {
      expect(resp).toBeDefined();
      expect(resp.code).toBe(400);
    });
  });

  it('should ack with code 400 for invalid room:chat payload', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u2', name: 'Bob' });
    registerRoomHandlers(io as any, socket as any);

    await socket.trigger('room:chat', { code: 'ABCD12', message: '' }, (resp: any) => {
      expect(resp).toBeDefined();
      expect(resp.code).toBe(400);
    });
  });

  it('should ack with code 400 for invalid game:start payload', async () => {
    const io = createFakeIO();
    const socket = createFakeSocket({ id: 'u1', name: 'Alice' });
    registerGameHandlers(io as any, socket as any);

    await socket.trigger('game:start', { bad: 'payload' }, (resp: any) => {
      expect(resp).toBeDefined();
      expect(resp.code).toBe(400);
    });
  });
});
