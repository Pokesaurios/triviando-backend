import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import express, { json } from "express";

import * as roomController from "../src/controllers/room.controller";

// Mock redis
jest.mock("../src/config/redis", () => ({
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
}));

describe("Room controller branches", () => {
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
      // @ts-ignore
      await collections[key].deleteMany({});
    }
    jest.clearAllMocks();
  });

  it("joinRoom without user returns 401", async () => {
    const app = express();
    app.use(json());
    app.post("/rooms/join", (req, res) => roomController.joinRoom(req as any, res));

    const res = await request(app).post("/rooms/join").send({ code: "ABC" });
    expect(res.status).toBe(401);
  });

  it("joinRoom with empty code returns 400", async () => {
    const app = express();
    app.use(json());
    // middleware to set req.user
    app.use((req, res, next) => {
      (req as any).user = { id: new mongoose.Types.ObjectId().toHexString() };
      next();
    });
    app.post("/rooms/join", (req, res) => roomController.joinRoom(req as any, res));

    const res = await request(app).post("/rooms/join").send({ code: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Código de sala requerido.");
  });

  it("joinRoom when joinRoomAtomically returns not ok yields 400", async () => {
    const joinMock = jest.spyOn(require("../src/services/joinRoom.service"), "joinRoomAtomically");
    joinMock.mockResolvedValue({ ok: false, message: "Room full" });

    const app = express();
    app.use(json());
    app.use((req, res, next) => {
      (req as any).user = { id: new mongoose.Types.ObjectId().toHexString() };
      next();
    });
    app.post("/rooms/join", (req, res) => roomController.joinRoom(req as any, res));

    const res = await request(app).post("/rooms/join").send({ code: "ROOM1" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Room full");
  });

  it("getRoomState with invalid code returns 400", async () => {
    const app = express();
    app.use(json());
    app.get("/rooms/:code", (req, res) => roomController.getRoomState(req as any, res));

    const res = await request(app).get("/rooms/INV$$");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Código de sala inválido.");
  });

  it("getRoomState handles corrupted cache and deletes it", async () => {
    const redis = require("../src/config/redis");
    (redis.get as jest.Mock).mockResolvedValue("{not-json");

    const app = express();
    app.use(json());
    app.get("/rooms/:code", (req, res) => roomController.getRoomState(req as any, res));

    const res = await request(app).get("/rooms/NOEXIST");
    expect(res.status).toBe(404);
    expect(redis.del).toHaveBeenCalled();
  });
});
