import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { registerRoomHandlers } from "./room.handlers";
import { socketAuthMiddleware } from "../middleware/socketAuth";
import { cleanupInactivePlayers, getActivePlayers } from "./presence.utils";
import redis from "../config/redis";

export async function initSocketServer(httpServer: any) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const redisUrl = process.env.REDIS_URL!;
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log("✅ Redis adapter connected for Socket.IO");

  // auth middleware
  io.use(async (socket: Socket, next) => {
    try {
      await socketAuthMiddleware(socket as any, next as any);
    } catch (err: unknown) {
      next(err instanceof Error ? err : new Error(String(err)));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🟢 Authenticated socket connected: ${socket.id} (user: ${(socket.data as any).user?.name})`);
    registerRoomHandlers(io, socket);
  });

  // limpieza periódica: sincroniza presence y notifica a salas
  setInterval(async () => {
    try {
      const keys = await redis.keys("room:*:activePlayers");
      for (const key of keys) {
        const roomCode = key.split(":")[1];
        const removed = await cleanupInactivePlayers(roomCode);
        if (removed.length > 0) {
          const activePlayers = await getActivePlayers(roomCode);
          io.to(roomCode).emit("room:update", {
            event: "cleanupInactive",
            inactive: removed,
            activePlayers,
          });
          console.log(`🧹 Cleanup: room ${roomCode} removed ${removed.length} inactive`);
        }
      }
    } catch (err) {
      console.error("periodic cleanup error:", err);
    }
  }, 30000);

  return io;
}
