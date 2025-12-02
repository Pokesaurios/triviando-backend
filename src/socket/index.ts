import { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socketAuth";
import { registerRoomHandlers } from "./room.handlers";
import { registerGameHandlers } from "./game.handlers";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { setIo } from "./ioRef";

export function initSocketServer(httpServer: any) {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : "*";

  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  // Configure Redis adapter for multi-instance broadcasting
  if (process.env.REDIS_URL) {
    const pub = new Redis(process.env.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use(socketAuthMiddleware);

  io.on("connection", (socket: Socket) => {
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
  });

  setIo(io);
  return io;
}