import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL!;
const redisClient = createClient({ url: redisUrl });

redisClient.connect().catch(console.error);

// Guardar jugadores y mensajes en estructuras separadas
export async function addPlayerToRoom(roomCode: string, user: any) {
  await redisClient.sAdd(`room:${roomCode}:players`, JSON.stringify(user));
}

export async function getPlayersInRoom(roomCode: string) {
  const members = await redisClient.sMembers(`room:${roomCode}:players`);
  return members.map((m) => JSON.parse(m));
}

export async function addChatMessage(roomCode: string, message: any) {
  await redisClient.rPush(`room:${roomCode}:chat`, JSON.stringify(message));
}

export async function getChatHistory(roomCode: string, limit = 30) {
  const messages = await redisClient.lRange(`room:${roomCode}:chat`, -limit, -1);
  return messages.map((m) => JSON.parse(m));
}

export async function clearRoomCache(roomCode: string) {
  await redisClient.del([
    `room:${roomCode}:players`,
    `room:${roomCode}:chat`,
  ]);
}
