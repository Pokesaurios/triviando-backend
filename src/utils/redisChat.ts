import redis from "../config/redis";

const CHAT_LIMIT = 20;

export async function addChatMessage(roomCode: string, message: any) {
  const key = `room:${roomCode}:chat`;
  await redis.rpush(key, JSON.stringify(message));
  await redis.ltrim(key, -CHAT_LIMIT, -1);
}

export async function getChatHistory(roomCode: string) {
  const key = `room:${roomCode}:chat`;
  const messages = await redis.lrange(key, 0, -1);
  return messages.map((m: string) => JSON.parse(m));
}