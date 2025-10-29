// tests/gameResult.controller.test.ts
import { getGameResults, getGameResultByRoom } from "../src/controllers/gameResult.controller";
import { GameResult } from "../src/models/gameResult.model";

jest.mock("../src/models/gameResult.model"); // Mocks the Mongoose model

describe("GameResult Controller (unit tests)", () => {
  const mockResults = [
    {
      _id: "1",
      roomCode: "ROOM123",
      triviaId: { _id: "t1", topic: "Science" },
      finishedAt: new Date(),
      scores: new Map([
        ["u1", 10],
        ["u2", 5],
      ]),
      players: [
        { userId: "u1", name: "Alice", score: 10 },
        { userId: "u2", name: "Bob", score: 5 },
      ],
      winner: { userId: "u1", name: "Alice", score: 10 },
    },
  ];

  // Mocks simples para req y res
  const mockRequest = (params = {}, body = {}, query = {}) =>
    ({ params, body, query } as any);

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------
  // getGameResults
  // -----------------------
  describe("getGameResults", () => {
    it("should return a list of results", async () => {
      // Encadena los mocks: find().sort().limit().populate()
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockPopulate = jest.fn().mockResolvedValue(mockResults);
      (GameResult.find as any) = jest.fn(() => ({
        sort: mockSort,
        limit: mockLimit,
        populate: mockPopulate,
      }));

      const req = mockRequest();
      const res = mockResponse();

      await getGameResults(req, res);

      expect(GameResult.find).toHaveBeenCalled();
      expect(mockSort).toHaveBeenCalledWith({ finishedAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockPopulate).toHaveBeenCalledWith("triviaId", "topic");
      expect(res.json).toHaveBeenCalledWith(mockResults);
      expect(res.status).not.toHaveBeenCalledWith(500);
    });

    it("should handle model errors", async () => {
      (GameResult.find as any) = jest.fn(() => ({
        sort: () => ({
          limit: () => ({
            populate: jest.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      }));

      const req = mockRequest();
      const res = mockResponse();

      await getGameResults(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "DB error" });
    });
  });

  // -----------------------
  // getGameResultByRoom
  // -----------------------
  describe("getGameResultByRoom", () => {
    it("should return a specific game result", async () => {
      const mockPopulate = jest.fn().mockResolvedValue(mockResults[0]);
      (GameResult.findOne as any) = jest.fn(() => ({
        populate: mockPopulate,
      }));

      const req = mockRequest({ code: "ROOM123" });
      const res = mockResponse();

      await getGameResultByRoom(req, res);

      expect(GameResult.findOne).toHaveBeenCalledWith({ roomCode: "ROOM123" });
      expect(mockPopulate).toHaveBeenCalledWith("triviaId", "topic");
      expect(res.json).toHaveBeenCalledWith(mockResults[0]);
    });

    it("should return 404 if result is not found", async () => {
      const mockPopulate = jest.fn().mockResolvedValue(null);
      (GameResult.findOne as any) = jest.fn(() => ({
        populate: mockPopulate,
      }));

      const req = mockRequest({ code: "UNKNOWN" });
      const res = mockResponse();

      await getGameResultByRoom(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Game result not found" });
    });

    it("debe manejar errores del modelo", async () => {
      const mockPopulate = jest.fn().mockRejectedValue(new Error("DB fail"));
      (GameResult.findOne as any) = jest.fn(() => ({
        populate: mockPopulate,
      }));

      const req = mockRequest({ code: "FAIL" });
      const res = mockResponse();

      await getGameResultByRoom(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "DB fail" });
    });
  });
});