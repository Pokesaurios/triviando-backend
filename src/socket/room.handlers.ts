// src/socket/room.handlers.ts
import { Server, Socket } from "socket.io";
import User from "../models/user.model";
import { Room } from "../models/room.model";
import redis from "../config/redis";
import {
  isDuplicateEvent,
  getRoomState,
  invalidateRoomCache,
} from "./utils";
import {
  setPlayerActive,
  removePlayerActive,
  getActivePlayers,
  refreshPlayerHeartbeat,
} from "./presence.utils";

export function registerRoomHandlers(io: Server, socket: Socket) {
  console.log(`🟢 User Connected: ${socket.id}`);

  let currentRoom: string | null = null;
  let currentUserId: string | null = null;

  // CREATE
  socket.on("room:create", async ({ userId }, ack) => {
    try {
      const userDoc = await User.findById(userId).select("name").lean();
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const room = new Room({
        code,
        hostId: userId,
        players: [{ userId, name: userDoc?.name || "Anonymous", joinedAt: new Date() }],
      });
      await room.save();
      await redis.setex(`room:${room.code}:state`, 120, JSON.stringify(room));

      currentRoom = code;
      currentUserId = userId;
      await setPlayerActive(code, userId);

      socket.join(code);
      socket.emit("room:joined", { code, players: room.players });
      ack?.({ ok: true, code });
    } catch (err: any) {
      console.error("room:create error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // JOIN
  socket.on("room:join", async ({ code, userId, eventId }, ack) => {
    try {
      if (await isDuplicateEvent(code, eventId)) return ack?.({ ok: true, message: "Duplicate event ignored" });

      const room = await getRoomState(code);
      if (!room) return ack?.({ ok: false, message: "Room not found" });

      const userDoc = await User.findById(userId).select("name").lean();

      // push objeto player si no existe
      const exists = room.players.find((p: any) => p.userId.toString() === userId);
      if (!exists) {
        await Room.updateOne(
          { code },
          { $push: { players: { userId, name: userDoc?.name || "Anonymous", joinedAt: new Date() } } }
        );
        await invalidateRoomCache(code);
      }

      currentRoom = code;
      currentUserId = userId;
      await setPlayerActive(code, userId);

      socket.join(code);

      // chat history (últimos 50, cronológico)
      const chatKey = `room:${code}:chat`;
      const chatMessages = await redis.lrange(chatKey, 0, 49);
      const chatHistory = chatMessages.map((m) => JSON.parse(m)).reverse();

      const activePlayers = await getActivePlayers(code);

      // enviar estado inicial SOLO al que entró
      socket.emit("room:init", {
        code,
        players: exists ? room.players : [...room.players, { userId, name: userDoc?.name || "Anonymous" }],
        activePlayers,
        chatHistory,
      });

      // notificar a la sala
      io.to(code).emit("room:update", {
        event: "playerJoined",
        player: { userId, name: userDoc?.name || "Anonymous" },
        activePlayers,
      });

      ack?.({ ok: true, code });
    } catch (err: any) {
      console.error("room:join error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // CHAT
  socket.on("room:chat", async ({ code, userId, message, eventId }, ack) => {
    try {
      if (await isDuplicateEvent(code, eventId)) return ack?.({ ok: true, message: "Duplicate event ignored" });

      const userDoc = await User.findById(userId).select("name").lean();
      const chatMessage = {
        userId,
        name: userDoc?.name || "Anonymous",
        message,
        timestamp: new Date().toISOString(),
      };

      const key = `room:${code}:chat`;
      await redis.lpush(key, JSON.stringify(chatMessage));
      await redis.ltrim(key, 0, 49);

      io.to(code).emit("room:chat:new", chatMessage);
      ack?.({ ok: true });
    } catch (err: any) {
      console.error("room:chat error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // HEARTBEAT
  socket.on("room:heartbeat", async ({ code, userId }, ack) => {
    try {
      await refreshPlayerHeartbeat(code, userId);
      ack?.({ ok: true });
    } catch (err: any) {
      console.error("room:heartbeat error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // DISCONNECT
  socket.on("disconnect", async () => {
    try {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
      if (currentRoom && currentUserId) {
        await removePlayerActive(currentRoom, currentUserId);
        const activePlayers = await getActivePlayers(currentRoom);
        io.to(currentRoom).emit("room:update", {
          event: "playerLeft",
          userId: currentUserId,
          activePlayers,
        });
      }
    } catch (err: any) {
      console.error("disconnect handler error:", err);
    }
  });
}