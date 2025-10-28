import { Request, Response } from "express";
import { GameResult } from "../models/gameResult.model";

export const getGameResults = async (req: Request, res: Response) => {
  try {
    const results = await GameResult.find()
      .sort({ finishedAt: -1 })
      .limit(20)
      .populate("triviaId", "topic");

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGameResultByRoom = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await GameResult.findOne({ roomCode: code }).populate("triviaId", "topic");
    if (!result) return res.status(404).json({ message: "Game result not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};