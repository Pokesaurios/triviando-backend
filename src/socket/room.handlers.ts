import { Server, Socket } from "socket.io";
import { Room, generateUniqueRoomCode } from "../models/room.model";
import { Trivia } from "../models/trivia.model";
import { generateQuestions } from "../services/aiGenerator.service";
import { addChatMessage, getChatHistory } from "../utils/redisChat";
import redis from "../config/redis";
import { getGameState } from "../services/game.service";
import { resolveUserName } from "../utils/userHelpers";
import { buildRoomCacheData } from "../utils/roomHelpers";
import logger from "../utils/logger";
import { socketValidator } from "./validateSocket";
import { joinRoomSchema, createRoomSchema, chatSchema, roomCodeParamSchema } from "../schemas/room";

const ROOM_CACHE_TTL = 120;

export function registerRoomHandlers(io: Server, socket: Socket) {
  let currentRoom: string | null = null;

  // ------------- room:create (via socket) -------------
  socket.on(
    "room:create",
    socketValidator(createRoomSchema, async ({ topic, maxPlayers = 4, quantity = 5 }, ack) => {
      try {
        const user = socket.data.user;

        // create trivia
        const questions = await generateQuestions(topic, quantity);
        const trivia = await new Trivia({ topic, questions, creator: user.id }).save();

        // generate unique code (model helper)
        const code = await generateUniqueRoomCode();

        // get user name (token might include name)
        const playerName = await resolveUserName(user.id, user.name);
        const player = { userId: user.id, name: playerName, joinedAt: new Date() };

        const room = await new Room({
          code,
          hostId: user.id,
          triviaId: trivia._id,
          maxPlayers,
          players: [player],
        }).save();

        // join socket to room
        socket.join(code);
        currentRoom = code;

        // set initial cache
        const cache = buildRoomCacheData(room);
        await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify(cache));

        // return to host
        ack?.({
          ok: true,
          room: {
            code,
            roomId: room._id,
            triviaId: trivia._id,
            maxPlayers,
            host: player.name,
            players: room.players.map((p: any) => ({ userId: p.userId.toString(), name: p.name, joinedAt: p.joinedAt })),
            chatHistory: [],
          },
        });

        // broadcast room created
        io.to(code).emit("room:update", { event: "roomCreated", code, roomId: room._id });

      } catch (err: any) {
        logger.error({ err: err?.message || err, socketId: socket.id, topic }, "room:create error");
        ack?.({ ok: false, error: err.message });
      }
    })
  );

  // ------------- room:join (socket) -------------
  socket.on(
    "room:join",
    socketValidator(joinRoomSchema, async ({ code }, ack) => {
      try {
        const user = socket.data.user;

        // resolver nombre si no viene en el token
        const userName = await resolveUserName(user.id, user.name);

        // atomic add: reuse your service or perform findOneAndUpdate
        const updated = await Room.findOneAndUpdate(
          { code, "players.userId": { $ne: user.id }, $expr: { $lt: [{ $size: "$players" }, "$maxPlayers"] } },
          { $push: { players: { userId: user.id, name: userName, joinedAt: new Date() } } },
          { new: true }
        ).lean();

        if (!updated) {
          const r = await Room.findOne({ code }).lean();
          if (!r) return ack?.({ ok: false, message: "Room not found" });
          if (r.players.some((p: any) => p.userId.toString() === user.id)) {
            // already in room: allow rejoin
            socket.join(code);
            currentRoom = code;
            const chatHistory = await getChatHistory(code);
            return ack?.({ ok: true, room: { code, players: r.players, chatHistory } });
          }
          logger.warn({ socketId: socket.id, code, userId: user.id }, "Attempt to join full or missing room");
          return ack?.({ ok: false, code: 403, message: "Room full or not found" });
        }

        socket.join(code);
        currentRoom = code;

        const chatHistory = await getChatHistory(code);

        // update cache
        const cache = buildRoomCacheData(updated);
        await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify(cache));

        io.to(code).emit("room:update", {
          event: "playerJoined",
          player: { userId: user.id, name: userName },
          players: updated.players.map((p: any) => ({ userId: p.userId.toString(), name: p.name, joinedAt: p.joinedAt })),
        });

        ack?.({ ok: true, room: { code, players: updated.players.map((p: any) => ({ userId: p.userId.toString(), name: p.name, joinedAt: p.joinedAt })), chatHistory } });

      } catch (err: any) {
        logger.error({ err: err?.message || err, socketId: socket.id, code: typeof code === 'string' ? code : 'unknown' }, "room:join error");
        ack?.({ ok: false, error: err.message });
      }
    })
  );

  // ------------- room:chat -------------
  socket.on(
    "room:chat",
    socketValidator(chatSchema, async ({ code, message }, ack) => {
      try {
        const user = socket.data.user;
        if (!socket.data.resolvedUserName) {
          socket.data.resolvedUserName = await resolveUserName(user.id, user.name);
        }
        const userName = socket.data.resolvedUserName;
        const chatMsg = { userId: user.id, user: userName, message, timestamp: new Date() };
        await addChatMessage(code, chatMsg);

        io.to(code).emit("room:chat:new", chatMsg);
        ack?.({ ok: true });
      } catch (err: any) {
        logger.warn({ err: err?.message || err, socketId: socket.id, code }, "room:chat error");
        ack?.({ ok: false, error: err.message });
      }
    })
  );

  // ------------- room:reconnect -------------
  socket.on(
    "room:reconnect",
    socketValidator(roomCodeParamSchema, async ({ code }, ack) => {
      try {
        const _user = socket.data.user;
        const room = await Room.findOne({ code }).lean();
        if (!room) return ack?.({ ok: false, message: "Room not found" });

        socket.join(code);
        currentRoom = code;

        const chatHistory = await getChatHistory(code);
        // include current gameState snapshot if exists
        const gameState = await getGameState(code);

        ack?.({ ok: true, room: { code, players: room.players.map((p: any) => ({ userId: p.userId.toString(), name: p.name, joinedAt: p.joinedAt })), chatHistory, gameState } });
      } catch (err: any) {
        logger.error({ err: err?.message || err, socketId: socket.id, code }, "room:reconnect error");
        ack?.({ ok: false, error: err.message });
      }
    })
  );

  // (game events moved to src/socket/game.handlers.ts)

  // ------------- disconnect -------------
  socket.on("disconnect", async () => {
    if (!currentRoom) return;
    const user = socket.data.user;
    io.to(currentRoom).emit("room:update", { event: "playerLeft", userId: user.id });
  });

}