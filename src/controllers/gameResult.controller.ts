import { Request, Response } from "express";
import { GameResult } from "../models/gameResult.model";

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
    const result = await GameResult.findOne({ roomCode: code }).populate("triviaId", "topic");
    if (!result) return res.status(404).json({ message: "Game result not found" });
    const obj = (result as any) && typeof (result as any).toObject === "function" ? (result as any).toObject() : result;
    if (obj && obj.scores instanceof Map) {
      obj.scores = Object.fromEntries(obj.scores);
    }
    res.json(obj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};