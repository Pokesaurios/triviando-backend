import { Request, Response } from "express";
import { GameResult } from "../models/gameResult.model";
import { Room } from "../models/room.model";
import logger from "../utils/logger";
import { forbidden } from "../utils/responses";

export const getGameResults = async (req: Request, res: Response) => {
  try {
    const results = await GameResult.find()
      .sort({ finishedAt: -1 })
      .limit(20)
      .populate("triviaId", "topic");

    // Normalize Map (scores) to plain object for consistent JSON output
    const cleaned = (results as any[]).map((r) => {
      const obj = r && typeof r.toObject === "function" ? r.toObject() : r;
      if (obj && obj.scores instanceof Map) {
        obj.scores = Object.fromEntries(obj.scores);
      }
      return obj;
    });

    res.json(cleaned);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGameResultByRoom = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const user = (req as any).user;

    const result = await GameResult.findOne({ roomCode: code }).populate("triviaId", "topic");
    if (!result) return res.status(404).json({ message: "Game result not found" });

    // If user present, check room membership/ownership for authorization
    if (user?.id) {
      const room = await Room.findOne({ code }).lean();
      if (!room) {
        logger.warn({ userId: user.id, code }, "Game result requested but room not found");
        return res.status(404).json({ message: "Room not found" });
      }

      const userId = user.id;
      const isHost = room.hostId && (room.hostId.toString ? room.hostId.toString() : room.hostId) === userId;
      const isPlayer = Array.isArray(room.players) && room.players.some((p: any) => (p.userId?._id?.toString?.() || p.userId?.toString?.() || p.userId) === userId);
      if (!isHost && !isPlayer) {
        logger.warn({ userId: user.id, code }, "Unauthorized attempt to access game result");
        return forbidden(res, "Forbidden");
      }
    }

    const obj = typeof (result as any)?.toObject === "function" ? (result as any).toObject() : result;
    if (obj && obj.scores instanceof Map) {
      obj.scores = Object.fromEntries(obj.scores);
    }
    res.json(obj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};