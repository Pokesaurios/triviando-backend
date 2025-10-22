import redis from "../config/redis";
import { Room } from "../models/room.model";

/**
 * Idempotencia de eventos por sala (SADD + EXPIRE).
 */
export async function isDuplicateEvent(roomCode: string, eventId?: string): Promise<boolean> {
  if (!eventId) return false;
  const key = `room:${roomCode}:events`;
  const added = await redis.sadd(key, eventId);
  await redis.expire(key, 600); // 10 min
  return added === 0;
}

/**
 * Obtener estado de sala (cacheado en Redis)
 */
const ROOM_CACHE_TTL = 120;
export async function getRoomState(roomCode: string) {
  const cacheKey = `room:${roomCode}:state`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const room = await Room.findOne({ code: roomCode }).populate("players.userId", "name").lean();
  if (!room) return null;

  await redis.setex(cacheKey, ROOM_CACHE_TTL, JSON.stringify(room));
  return room;
}

export async function invalidateRoomCache(roomCode: string) {
  await redis.del(`room:${roomCode}:state`);
}