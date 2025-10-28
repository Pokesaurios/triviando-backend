import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import express, { json } from "express";

import { Room } from "../src/models/room.model";
import { Trivia } from "../src/models/trivia.model";
import * as roomController from "../src/controllers/room.controller";
import * as aiService from "../src/services/aiGenerator.service";
import redis from "../src/config/redis";
import User from "../src/models/user.model";

jest.setTimeout(30000);

// --- Mocks ---
jest.spyOn(aiService, "generateQuestions").mockImplementation(async (topic, quantity) => {
  return Array.from({ length: quantity }, (_, i) => ({
    question: `${topic} Question ${i + 1}`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    difficulty: "easy",
  }));
});

// Mock Redis
jest.mock("../src/config/redis", () => ({
  setex: jest.fn(),
  get: jest.fn(),
}));

// Mock User.findById
jest.spyOn(User, "findById").mockImplementation((id: any) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue({ _id: id, name: "TestUser" }),
}) as any);

// --- Setup Express ---
const app = express();
app.use(json());

// Middleware temporal para simular req.user
app.use((req, res, next) => {
  const r = req as any;
  if (r.body?.user) r.user = r.body.user;
  next();
});

app.post("/rooms", (req, res) => roomController.createRoom(req as any, res));
app.post("/rooms/join", (req, res) => roomController.joinRoom(req as any, res));
app.get("/rooms/:code", (req, res) => roomController.getRoomState(req as any, res));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.clearAllMocks();
});

// ------------------- TESTS -------------------
describe("Room API integration tests", () => {
  let userId: string;

  beforeEach(() => {
    userId = new Types.ObjectId().toHexString();
  });

  it("should create a room successfully", async () => {
    const res = await request(app)
      .post("/rooms")
      .send({ topic: "Science", maxPlayers: 5, quantity: 5, user: { id: userId, name: "TestUser" } });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Sala creada 🎉");
    expect(res.body.host).toBe("TestUser");
    expect(res.body.maxPlayers).toBe(5);
    expect(res.body.code).toHaveLength(6);

    // Verificar en DB
    const roomInDb = await Room.findOne({ code: res.body.code }).lean();
    expect(roomInDb).toBeTruthy();
    expect(roomInDb?.players[0].userId.toString()).toBe(userId);
  });

  it("should fail to create a room with invalid topic", async () => {
    const res = await request(app)
      .post("/rooms")
      .send({ topic: "", maxPlayers: 5, quantity: 5, user: { id: userId, name: "TestUser" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Debes enviar un tema válido.");
  });

  it("should fail to create a room with invalid quantity", async () => {
    const res = await request(app)
      .post("/rooms")
      .send({ topic: "Math", maxPlayers: 5, quantity: 3, user: { id: userId, name: "TestUser" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cantidad de preguntas inválida (5 a 20).");
  });

  it("should fail to create a room with invalid maxPlayers", async () => {
    const res = await request(app)
      .post("/rooms")
      .send({ topic: "Math", maxPlayers: 1, quantity: 8, user: { id: userId, name: "TestUser" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Número de jugadores inválido (2 a 10).");
  });

  it("should join an existing room", async () => {
    // Crear sala
    const trivia = await new Trivia({ topic: "Test", questions: [] }).save();
    const room = await new Room({ code: "ABC123", hostId: userId, triviaId: trivia._id, players: [{ userId: new Types.ObjectId(userId), name: "Host" }] }).save();

    // Mock joinRoomAtomically
    jest.spyOn(require("../src/services/joinRoom.service"), "joinRoomAtomically").mockResolvedValue({
      ok: true,
      message: "Joined room",
      room,
    });

    const res = await request(app)
      .post("/rooms/join")
      .send({ code: "ABC123", user: { id: new Types.ObjectId().toHexString(), name: "Player2" } });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Joined room");
    expect(res.body.room.code).toBe("ABC123");
  });

  it("should get room state from DB", async () => {
    const trivia = await new Trivia({ topic: "Test", questions: [] }).save();
    const room = await new Room({ code: "XYZ999", hostId: userId, triviaId: trivia._id, players: [{ userId: new Types.ObjectId(userId), name: "Host" }] }).save();

    // Forzar que redis no devuelva cache
    (redis.get as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/rooms/XYZ999");

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("db");
    expect(res.body.room.code).toBe("XYZ999");
  });

  it("should return 404 if room not found", async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/rooms/NOEXIST");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Sala no encontrada.");
  });

  it("should get room state from cache", async () => {
    const fakeCache = {
      code: "CACHE1",
      status: "waiting",
      players: [{ userId, name: "TestUser" }],
      maxPlayers: 4,
      hostId: userId,
    };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(fakeCache));

    const res = await request(app).get("/rooms/CACHE1");

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
    expect(res.body.room.code).toBe("CACHE1");
  });
});