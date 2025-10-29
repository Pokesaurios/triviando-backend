import {
  attemptFirstPress,
  dedupeEvent,
  initGameState,
  getGameState,
  saveGameState,
  scheduleTimer,
  clearTimer,
  resetFirstPress,
  timersMap,
} from "../src/services/game.service";
import * as redisHelpers from "../src/utils/redisHelpers";
import redis from "../src/config/redis";
import { Trivia } from "../src/models/trivia.model";

jest.mock("../src/utils/redisHelpers", () => ({
  setNxPx: jest.fn(),
}));

jest.mock("../src/config/redis", () => ({
  sadd: jest.fn(),
  expire: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  incr: jest.fn(),
  del: jest.fn(),
}));

jest.mock("../src/models/trivia.model", () => ({
  Trivia: { findById: jest.fn() },
}));

describe("game.service helpers", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("attemptFirstPress", () => {
    it("returns true when setNxPx returns OK", async () => {
      (redisHelpers.setNxPx as jest.Mock).mockResolvedValueOnce("OK");
      const res = await attemptFirstPress("ROOM1", "user1", 2000);
      expect(res).toBe(true);
      expect(redisHelpers.setNxPx).toHaveBeenCalledWith("room:ROOM1:firstPress", "user1", 2000);
    });

    it("returns false when setNxPx returns null", async () => {
      (redisHelpers.setNxPx as jest.Mock).mockResolvedValueOnce(null);
      const res = await attemptFirstPress("ROOM2", "user2", 1000);
      expect(res).toBe(false);
    });
  });

  describe("dedupeEvent", () => {
    it("returns true for empty eventId", async () => {
      const res = await dedupeEvent("ROOMX", "");
      expect(res).toBe(true);
    });

    it("returns true and sets expire when sadd returns 1", async () => {
      (redis.sadd as jest.Mock).mockResolvedValueOnce(1);
      const res = await dedupeEvent("ROOMY", "evt-123", 15);
      expect(res).toBe(true);
      expect(redis.sadd).toHaveBeenCalledWith("room:ROOMY:eventIds", "evt-123");
      expect(redis.expire).toHaveBeenCalledWith("room:ROOMY:eventIds", 15);
    });

    it("returns false when sadd returns 0 (duplicate)", async () => {
      (redis.sadd as jest.Mock).mockResolvedValueOnce(0);
      const res = await dedupeEvent("ROOMZ", "evt-dup", 10);
      expect(res).toBe(false);
      expect(redis.expire).not.toHaveBeenCalled();
    });
  });

  describe("state persistence and timers", () => {
    it("initGameState saves state and returns it", async () => {
      // mock Trivia.findById().lean()
      (Trivia.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "t1" }) });
      (redis.set as jest.Mock).mockResolvedValueOnce("OK");

      const players = [{ userId: "u1", name: "Alice" }];
      const state = await initGameState("RC", "t1", players);

      expect(state.roomCode).toBe("RC");
      expect(state.scores["u1"]).toBe(0);
      expect(redis.set).toHaveBeenCalledWith("room:RC:game", JSON.stringify(state));
    });

    it("saveGameState calls redis.set and getGameState returns parsed object", async () => {
      const sample = { roomCode: "R2", triviaId: "t2", status: "in-game" } as any;
      (redis.set as jest.Mock).mockResolvedValueOnce("OK");
      await saveGameState("R2", sample);
      expect(redis.set).toHaveBeenCalledWith("room:R2:game", JSON.stringify(sample));

      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(sample));
      const got = await getGameState("R2");
      expect(got).toEqual(sample);
    });

    it("getGameState handles corrupted JSON by deleting and metricing", async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce("{ not valid json");
      (redis.incr as jest.Mock).mockResolvedValueOnce(1);
      (redis.expire as jest.Mock).mockResolvedValueOnce(1);
      (redis.del as jest.Mock).mockResolvedValueOnce(1);

      const res = await getGameState("BAD");
      expect(res).toBeNull();
      expect(redis.incr).toHaveBeenCalledWith("room:BAD:game:corrupt_count");
      expect(redis.expire).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("room:BAD:game");
    });

    it("scheduleTimer triggers function after delay and clearTimer prevents it", async () => {
      jest.useFakeTimers();
      const fn = jest.fn();

      scheduleTimer("k1", fn, 1000);
      expect(timersMap.has("k1")).toBe(true);

      // clearing before run should cancel
      clearTimer("k1");
      jest.runAllTimers();
      expect(fn).not.toHaveBeenCalled();

      // schedule again and let it run
      scheduleTimer("k2", fn, 500);
      expect(timersMap.has("k2")).toBe(true);
      jest.runAllTimers();
      expect(fn).toHaveBeenCalled();
      expect(timersMap.has("k2")).toBe(false);
      jest.useRealTimers();
    });

    it("resetFirstPress calls redis.del with correct key", async () => {
      (redis.del as jest.Mock).mockResolvedValueOnce(1);
      await resetFirstPress("RM");
      expect(redis.del).toHaveBeenCalledWith("room:RM:firstPress");
    });
  });
});
