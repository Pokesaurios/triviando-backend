import { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socketAuth";
import { registerRoomHandlers } from "./room.handlers";

export function initSocketServer(httpServer: any) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket: Socket) => {
    console.log(`🟢 Connected: ${socket.data.user.name}`);
    registerRoomHandlers(io, socket);
  });

  return io;
}