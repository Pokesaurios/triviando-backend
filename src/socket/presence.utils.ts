import redis from "../config/redis";

const ACTIVE_TTL = 60; // segundos

export async function setPlayerActive(roomCode: string, userId: string) {
  const key = `room:${roomCode}:activePlayers`;
  await redis.hset(key, userId, Date.now().toString());
  await redis.expire(key, ACTIVE_TTL);
}

export async function refreshPlayerHeartbeat(roomCode: string, userId: string) {
  const key = `room:${roomCode}:activePlayers`;
  const exists = await redis.hexists(key, userId);
  if (exists) {
    await redis.hset(key, userId, Date.now().toString());
    await redis.expire(key, ACTIVE_TTL);
  }
}

export async function removePlayerActive(roomCode: string, userId: string) {
  const key = `room:${roomCode}:activePlayers`;
  await redis.hdel(key, userId);
}

export async function getActivePlayers(roomCode: string): Promise<string[]> {
  const key = `room:${roomCode}:activePlayers`;
  const players = await redis.hkeys(key);
  return players || [];
}

/**
 * Limpia jugadores cuyo lastSeen excede ACTIVE_TTL y devuelve lista de userIds eliminados.
 */
export async function cleanupInactivePlayers(roomCode: string) {
  const key = `room:${roomCode}:activePlayers`;
  const all = await redis.hgetall(key);
  const now = Date.now();
  const removed: string[] = [];
  for (const [userId, lastSeenStr] of Object.entries(all)) {
    const lastSeen = parseInt(lastSeenStr, 10);
    if (Number.isNaN(lastSeen) || now - lastSeen > ACTIVE_TTL * 1000) {
      removed.push(userId);
      await redis.hdel(key, userId);
    }
  }
  return removed;
}