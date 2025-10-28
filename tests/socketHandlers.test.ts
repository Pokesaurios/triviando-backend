import { Server } from "socket.io";
import { registerRoomHandlers } from "../src/socket/room.handlers";
import { generateQuestions } from "../src/services/aiGenerator.service";
import redis from "../src/config/redis";
import { addChatMessage, getChatHistory } from "../src/utils/redisChat";

// ──────────────────────────────────────────────
// MOCKS DE DEPENDENCIAS
// ──────────────────────────────────────────────

// Mock de AI Generator
jest.mock("../src/services/aiGenerator.service", () => ({
  generateQuestions: jest.fn().mockResolvedValue([
    { question: "¿Capital de Francia?", options: ["Paris", "Roma"], answer: "Paris" },
  ]),
}));

// Mock de Redis
jest.mock("../src/config/redis", () => ({
  setex: jest.fn().mockResolvedValue(true),
}));

// Mock de Redis Chat Utils
jest.mock("../src/utils/redisChat", () => ({
  addChatMessage: jest.fn(),
  getChatHistory: jest.fn().mockResolvedValue([]),
}));

// Mock de Trivia Model
jest.mock("../src/models/trivia.model", () => {
  const mockSave = jest.fn().mockResolvedValue({
    _id: "trivia1",
    topic: "Ciencia",
    questions: [],
    creator: "user1",
  });

  return {
    Trivia: jest.fn().mockImplementation(() => ({
      save: mockSave,
    })),
  };
});

// Mock de User Model
jest.mock("../src/models/user.model", () => ({
  __esModule: true,
  default: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: "Ana" }),
      }),
    }),
  },
}));

// Mock de Room Model
jest.mock("../src/models/room.model", () => {
  const mockSave = jest.fn().mockResolvedValue({
    _id: "room1",
    code: "ROOM123",
    status: "waiting",
    players: [{ userId: "user1", name: "Ana" }],
    maxPlayers: 4,
    hostId: "user1",
  });

  const MockRoom: any = jest.fn().mockImplementation(() => ({
    save: mockSave,
  }));

  (MockRoom as any).findOneAndUpdate = jest.fn();
  (MockRoom as any).findOne = jest.fn();
  (MockRoom as any).create = jest.fn();

  return {
    Room: MockRoom,
    generateUniqueRoomCode: jest.fn().mockResolvedValue("ROOM123"),
  };
});

// ──────────────────────────────────────────────
// CONFIGURACIÓN DE SOCKET MOCK
// ──────────────────────────────────────────────

describe("registerRoomHandlers", () => {
  let ioMock: any;
  let socketMock: any;
  let ack: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    ack = jest.fn();

    ioMock = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    socketMock = {
      data: { user: { id: "user1", name: "Ana" } },
      on: jest.fn((event, handler) => {
        (socketMock.handlers ||= {})[event] = handler;
      }),
      join: jest.fn(),
    };

    registerRoomHandlers(ioMock as unknown as Server, socketMock);
  });

  // ──────────────────────────────────────────────
  // ✅ TEST: CREAR SALA
  // ──────────────────────────────────────────────
  test("should handle room:create successfully", async () => {
    await socketMock.handlers["room:create"]({ topic: "Ciencia", maxPlayers: 4, quantity: 5 }, ack);

    expect(generateQuestions).toHaveBeenCalledWith("Ciencia", 5);
    expect(redis.setex).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        room: expect.objectContaining({
          code: "ROOM123",
          triviaId: "trivia1",
          host: "Ana",
        }),
      })
    );
  });

  // ──────────────────────────────────────────────
  // ✅ TEST: UNIRSE A SALA
  // ──────────────────────────────────────────────
  test("should handle room:join successfully", async () => {
    const { Room } = require("../src/models/room.model");
    Room.findOneAndUpdate.mockResolvedValue({
      code: "ROOM123",
      status: "waiting",
      players: [{ userId: "user1", name: "Ana" }],
      maxPlayers: 4,
      hostId: "user1",
    });

    await socketMock.handlers["room:join"]({ code: "ROOM123" }, ack);

    expect(Room.findOneAndUpdate).toHaveBeenCalled();
    expect(redis.setex).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        room: expect.objectContaining({
          code: "ROOM123",
          players: expect.any(Array),
          chatHistory: expect.any(Array),
        }),
      })
    );
  });

  // ──────────────────────────────────────────────
  // ✅ TEST: CHAT
  // ──────────────────────────────────────────────
  test("should handle room:chat successfully", async () => {
    await socketMock.handlers["room:chat"]({ code: "ROOM123", message: "Hola!" }, ack);

    expect(addChatMessage).toHaveBeenCalled();
    expect(ioMock.emit).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  // ──────────────────────────────────────────────
  // ✅ TEST: RECONNECT
  // ──────────────────────────────────────────────
  test("should handle room:reconnect successfully", async () => {
    const { Room } = require("../src/models/room.model");
    Room.findOne.mockResolvedValue({
      code: "ROOM123",
      players: [{ userId: "user1", name: "Ana" }],
    });

    await socketMock.handlers["room:reconnect"]({ code: "ROOM123" }, ack);

    expect(Room.findOne).toHaveBeenCalledWith({ code: "ROOM123" });
    expect(getChatHistory).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        room: expect.objectContaining({
          code: "ROOM123",
          players: expect.any(Array),
        }),
      })
    );
  });

  // ──────────────────────────────────────────────
  // ✅ TEST: DISCONNECT
  // ──────────────────────────────────────────────
  test("should handle disconnect event", async () => {
    socketMock.join("ROOM123");
    socketMock.handlers["disconnect"]?.();
    expect(ioMock.to).not.toBeNull();
  });
});