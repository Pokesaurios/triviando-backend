import { Request, Response } from "express";
import { Room, generateUniqueRoomCode } from "../models/room.model";
import { Trivia } from "../models/trivia.model";
import { generateQuestions } from "../services/aiGenerator.service";
import redis from "../config/redis";
import { joinRoomAtomically } from "../services/joinRoom.service";
import { resolveUserName } from "../utils/userHelpers";
import { buildRoomCacheData, buildSanitizedRoom } from "../utils/roomHelpers";
import logger from "../utils/logger";
import { unauthorized, forbidden } from "../utils/responses";

const ROOM_CACHE_TTL = 120;

export const createRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ message: "No autorizado. Debes iniciar sesión para crear una sala." });
    }

    const { topic, maxPlayers = 4, quantity = 5 } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ message: "Debes enviar un tema válido." });
    }
    if (quantity < 5 || quantity > 20) {
      return res.status(400).json({ message: "Cantidad de preguntas inválida (5 a 20)." });
    }
    if (maxPlayers < 2 || maxPlayers > 20) {
      return res.status(400).json({ message: "Número de jugadores inválido (2 a 20)." });
    }

    const questions = await generateQuestions(topic, quantity);
    const trivia = await new Trivia({ topic, questions, creator: user.id }).save();

    const code = await generateUniqueRoomCode();

    const playerName = await resolveUserName(user.id, user.name);

    const player = {
      userId: user.id,
      name: playerName,
      joinedAt: new Date(),
    };

    const room = await new Room({
      code,
      hostId: user.id,
      triviaId: trivia._id,
      maxPlayers,
      players: [player],
    }).save();

    const cacheData = buildRoomCacheData(room);
    await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify(cacheData));

    return res.status(201).json({
      message: "Sala creada 🎉",
      code: room.code,
      triviaId: trivia._id,
      maxPlayers,
      host: player.name,
    });
  } catch (error: any) {
    logger.error({ err: error?.message || error, body: req.body }, "createRoom error");
    return res.status(500).json({
      message: "Error creando la sala",
      error: error.message,
    });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { code } = req.body;

    if (!user?.id) return unauthorized(res, "Unauthorized");
    if (!code?.trim()) return res.status(400).json({ message: "Código de sala requerido." });

    // A veces el payload del token no incluye el nombre; obtenerlo de la BD si falta
    const userName = await resolveUserName(user.id, user.name);

    const { ok, message, room } = await joinRoomAtomically(code, user.id, userName);
    if (!ok) return res.status(400).json({ message });

    const cacheData = buildRoomCacheData(room);
    await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify(cacheData));

    const sanitizedRoom = buildSanitizedRoom(room);
    return res.status(200).json({ message, room: sanitizedRoom });
  } catch (error: any) {
    logger.error({ err: error?.message || error, body: req.body, code: req.body?.code }, "joinRoom error");
    return res.status(500).json({
      message: "Error al unirse a la sala",
      error: error.message,
    });
  }
};

export const getRoomState = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const user = (req as any).user;
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ message: "Código de sala requerido." });
    }

    const sanitizedCode = code.trim();
    // Enforce allowed characters to avoid query selector injection
    const ROOM_CODE_REGEX = /^[A-Za-z0-9]{4,10}$/;
    if (sanitizedCode.includes("$") || sanitizedCode.includes(".") || !ROOM_CODE_REGEX.test(sanitizedCode)) {
      return res.status(400).json({ message: "Código de sala inválido." });
    }

    const cached = await redis.get(`room:${sanitizedCode}:state`);
    if (cached) {
      try {
        const room = JSON.parse(cached);
        // If user present, enforce Authorization: only host or players can view detailed room state
        const userId = user?.id;
        if (userId) {
          const isHost = room.hostId && (room.hostId.toString ? room.hostId.toString() : room.hostId) === userId;
          const isPlayer = Array.isArray(room.players) && room.players.some((p: any) => (p.userId?.toString?.() || p.userId) === userId);
          if (!isHost && !isPlayer) {
            logger.warn({ ip: req.ip, path: req.originalUrl, userId, code: sanitizedCode }, "Unauthorized access to room state");
            return forbidden(res, "Forbidden");
          }
        }
        return res.status(200).json({ source: "cache", room });
      } catch {
        await redis.del(`room:${sanitizedCode}:state`);
      }
    }

    const room = await Room.findOne({ code: sanitizedCode })
      .populate("players.userId", "name")
      .lean();

    if (!room) return res.status(404).json({ message: "Sala no encontrada." });

    // If user present, enforce Authorization: only host or players can view detailed room state
    const userId = user?.id;
    if (userId) {
      const isHost = room.hostId && (room.hostId.toString ? room.hostId.toString() : room.hostId) === userId;
      const isPlayer = Array.isArray(room.players) && room.players.some((p: any) => (p.userId?._id?.toString?.() || p.userId?.toString?.() || p.userId) === userId);
      if (!isHost && !isPlayer) {
        logger.warn({ ip: req.ip, path: req.originalUrl, userId, code: sanitizedCode }, "Unauthorized access to room state");
        return forbidden(res, "Forbidden");
      }
    }

    const safePlayers = room.players.map((p: any) => ({
      userId:
        p.userId?._id?.toString() ||
        p.userId?.toString() ||
        null,
      name: p.userId?.name || p.name || "Unknown",
      joinedAt: p.joinedAt,
    }));

    const cacheData = buildRoomCacheData(room);
    cacheData.players = safePlayers;
    await redis.setex(`room:${sanitizedCode}:state`, ROOM_CACHE_TTL, JSON.stringify(cacheData));

    return res.status(200).json({ source: "db", room: cacheData });
  } catch (error: any) {
    logger.error({ err: error?.message || error, params: req.params }, "getRoomState error");
    return res.status(500).json({
      message: "Error obteniendo estado de la sala",
      error: error.message,
    });
  }
};