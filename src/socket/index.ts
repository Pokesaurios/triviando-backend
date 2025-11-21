import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { socketAuthMiddleware } from "../middleware/socketAuth";
import { registerRoomHandlers } from "./room.handlers";
import redis from "../config/redis";

export function initSocketServer(httpServer: any) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Configure Redis adapter for horizontal scaling
  // This allows Socket.IO to work across multiple instances
  if (process.env.REDIS_URL) {
    try {
      // Create a duplicate Redis client for pub/sub
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();

      // Handle connection errors for duplicated clients
      pubClient.on("error", (err) => {
        console.error("❌ Socket.IO Redis pub client error:", err);
      });
      subClient.on("error", (err) => {
        console.error("❌ Socket.IO Redis sub client error:", err);
      });

      // Set up the Redis adapter
      io.adapter(createAdapter(pubClient, subClient));
      console.log("✅ Socket.IO Redis adapter configured for horizontal scaling");
    } catch (error) {
      console.error("❌ Failed to configure Socket.IO Redis adapter:", error);
      console.warn("⚠️  Running without Redis adapter - not suitable for production with multiple instances");
    }
  } else {
    console.warn("⚠️  REDIS_URL not configured - Socket.IO will not sync across multiple instances");
  }

  io.use(socketAuthMiddleware);

  io.on("connection", (socket: Socket) => {
    console.log(`🟢 Connected: ${socket.data.user.name}`);
    registerRoomHandlers(io, socket);
  });

  return io;
}