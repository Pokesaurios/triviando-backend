import { Request, Response } from "express";
import { Room, generateRoomCode } from "../models/room.model";
import { Types } from "mongoose";
import redis from "../config/redis";
import User from "../models/user.model";

const ROOM_CACHE_TTL = 120; // segundos

export const createRoom = async (req: Request, res: Response) => {
  try {
    const { topic, triviaId, maxPlayers = 4 } = req.body;
    const user = (req as any).user;
    if (!user || !user.id) return res.status(401).json({ message: "Unauthorized" });

    // Generar código único
    let code: string | null = null;
    for (let i = 0; i < 8; i++) {
      const candidate = generateRoomCode();
      const exists = await Room.findOne({ code: candidate }).lean();
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) return res.status(500).json({ message: "Cannot generate unique room code." });

    // Obtener nombre del usuario
    const userDoc = await User.findById(user.id).select("name").lean();
    const player = {
      userId: user.id,
      name: userDoc?.name || "Anonymous",
      joinedAt: new Date(),
    };

    const room = new Room({
      code,
      hostId: user.id,
      topic,
      triviaId: triviaId ? new Types.ObjectId(triviaId) : undefined,
      maxPlayers,
      players: [player],
    });

    await room.save();

    // Cachear en Redis
    await redis.setex(`room:${room.code}:state`, ROOM_CACHE_TTL, JSON.stringify(room));

    return res.status(201).json({
      message: "Room created successfully 🎉",
      roomId: room._id,
      code: room.code,
      topic: room.topic,
      maxPlayers: room.maxPlayers,
      host: player.name,
    });
  } catch (error: any) {
    console.error("createRoom error:", error);
    return res.status(500).json({ message: "Error creating room", error: error.message });
  }
};

export const getRoomState = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const cached = await redis.get(`room:${code}:state`);
    if (cached) {
      return res.status(200).json({ source: "cache", room: JSON.parse(cached) });
    }

    const room = await Room.findOne({ code }).populate("players.userId", "name").lean();
    if (!room) return res.status(404).json({ message: "Room not found" });

    await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify(room));
    return res.status(200).json({ source: "db", room });
  } catch (error: any) {
    console.error("getRoomState error:", error);
    return res.status(500).json({ message: "Error getting room state", error: error.message });
  }
};