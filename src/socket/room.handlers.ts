import { Server, Socket } from "socket.io";
import { Room, generateUniqueRoomCode } from "../models/room.model";
import { Trivia } from "../models/trivia.model";
import User from "../models/user.model";
import { generateQuestions } from "../services/aiGenerator.service";
import { addChatMessage, getChatHistory } from "../utils/redisChat";
import redis from "../config/redis";
import { Types } from "mongoose";
import { 
  initGameState, 
  getGameState, 
  saveGameState, 
  scheduleTimer, 
  clearTimer,
  attemptFirstPress,
  resetFirstPress,
  dedupeEvent,
  DEFAULT_QUESTION_READ_MS,
  MAX_BUTTON_DELAY_MS,
  MIN_BUTTON_DELAY_MS,
  PRESS_WINDOW_MS,
  ANSWER_TIMEOUT_MS
} from "../services/game.service";
import { GameResult } from "../models/gameResult.model";

const ROOM_CACHE_TTL = 120;

export function registerRoomHandlers(io: Server, socket: Socket) {
  let currentRoom: string | null = null;

  // ------------- room:create (via socket) -------------
  socket.on("room:create", async ({ topic, maxPlayers = 4, quantity = 5 }, ack) => {
    try {
      const user = socket.data.user;
      if (!topic?.trim()) return ack?.({ ok: false, message: "Topic required" });

      if (quantity < 5 || quantity > 20) return ack?.({ ok: false, message: "Quantity 5-20 required" });
      if (maxPlayers < 2 || maxPlayers > 10) return ack?.({ ok: false, message: "maxPlayers 2-10 required" });

      // create trivia
      const questions = await generateQuestions(topic, quantity);
      const trivia = await new Trivia({ topic, questions, creator: user.id }).save();

      // generate unique code (model helper)
      const code = await generateUniqueRoomCode();

      // get user name (token might include name)
      const userDoc = await User.findById(user.id).select("name").lean();
      const player = { userId: user.id, name: userDoc?.name || "Anonymous", joinedAt: new Date() };

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
      await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify({
        code,
        status: room.status,
        players: room.players.map((p:any) => ({ userId: p.userId, name: p.name })),
        maxPlayers: room.maxPlayers,
        hostId: room.hostId,
      }));

      // return to host
      ack?.({
        ok: true,
        room: {
          code,
          roomId: room._id,
          triviaId: trivia._id,
          maxPlayers,
          host: player.name,
          players: room.players,
          chatHistory: [],
        },
      });

      // broadcast room created
      io.to(code).emit("room:update", { event: "roomCreated", code, roomId: room._id });

    } catch (err: any) {
      console.error("[room:create] error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // ------------- room:join (socket) -------------
  socket.on("room:join", async ({ code }, ack) => {
    try {
      const user = socket.data.user;
      if (!code) return ack?.({ ok: false, message: "Room code required" });

      // atomic add: reuse your service or perform findOneAndUpdate
      const updated = await Room.findOneAndUpdate(
        { code, "players.userId": { $ne: user.id }, $expr: { $lt: [{ $size: "$players" }, "$maxPlayers"] } },
        { $push: { players: { userId: user.id, name: user.name, joinedAt: new Date() } } },
        { new: true }
      ).lean();

      if (!updated) {
        const r = await Room.findOne({ code }).lean();
        if (!r) return ack?.({ ok: false, message: "Room not found" });
        if (r.players.some((p:any) => p.userId.toString() === user.id)) {
          // already in room: allow rejoin
          socket.join(code);
          currentRoom = code;
          const chatHistory = await getChatHistory(code);
          return ack?.({ ok: true, room: { code, players: r.players, chatHistory } });
        }
        return ack?.({ ok: false, message: "Room full or not found" });
      }

      socket.join(code);
      currentRoom = code;

      const chatHistory = await getChatHistory(code);

      // update cache
      await redis.setex(`room:${code}:state`, ROOM_CACHE_TTL, JSON.stringify({
        code,
        status: updated.status,
        players: updated.players.map((p:any) => ({ userId: p.userId, name: p.name })),
        maxPlayers: updated.maxPlayers,
        hostId: updated.hostId,
      }));

      io.to(code).emit("room:update", {
        event: "playerJoined",
        player: { id: user.id, name: user.name },
        players: updated.players,
      });

      ack?.({ ok: true, room: { code, players: updated.players, chatHistory } });

    } catch (err: any) {
      console.error("[room:join] error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // ------------- room:chat -------------
  socket.on("room:chat", async ({ code, message }, ack) => {
    try {
      if (!message?.trim()) return ack?.({ ok: false, message: "Message required" });
      if (message.length > 400) return ack?.({ ok: false, message: "Message too long" });

      const user = socket.data.user;
      const chatMsg = { userId: user.id, user: user.name, message, timestamp: new Date() };
      await addChatMessage(code, chatMsg);

      io.to(code).emit("room:chat:new", chatMsg);
      ack?.({ ok: true });
    } catch (err: any) {
      console.error("[room:chat] error:", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // ------------- room:reconnect -------------
  socket.on("room:reconnect", async ({ code }, ack) => {
    try {
      if (!code) return ack?.({ ok: false, message: "Room code required" });
      const user = socket.data.user;
      const room = await Room.findOne({ code }).lean();
      if (!room) return ack?.({ ok: false, message: "Room not found" });

      socket.join(code);
      currentRoom = code;

      const chatHistory = await getChatHistory(code);
      // include current gameState snapshot if exists
      const gameState = await getGameState(code);

      ack?.({ ok: true, room: { code, players: room.players, chatHistory, gameState } });
    } catch (err:any) {
      console.error("[room:reconnect]", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // ------------- game:start -------------
  socket.on("game:start", async ({ code }, ack) => {
    try {
      const user = socket.data.user;
      if (!code) return ack?.({ ok: false, message: "Room code required" });

      // verify host
      const room = await Room.findOne({ code }).lean();
      if (!room) return ack?.({ ok: false, message: "Room not found" });
      if (room.hostId.toString() !== user.id) return ack?.({ ok: false, message: "Only host can start the game" });

      // change room status
      await Room.findOneAndUpdate({ code }, { status: "in-progress" }).exec();
      
      // init game state in redis
      const players = room.players.map((p:any) => ({ userId: p.userId.toString(), name: p.name }));
      await initGameState(code, room.triviaId.toString(), players);

      // get trivia safely and compute total questions
      const triviaDoc = await Trivia.findById(room.triviaId).lean();
      const totalQuestions = Array.isArray(triviaDoc?.questions) ? triviaDoc.questions.length : 0;
      io.to(code).emit("game:started", { ok: true, totalQuestions });

      // start first round
      await startRound(code, io);

      ack?.({ ok: true });
    } catch (err:any) {
      console.error("[game:start]", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  // --------- helper functions inside handler file ----------

  async function startRound(code: string, ioInstance: Server) {
    const state = await getGameState(code);
    if (!state) return;
    const trivia = await Trivia.findById(state.triviaId).lean();
    if (!trivia) return;

    const q = trivia!.questions[state.currentQuestionIndex];
    const readMs = DEFAULT_QUESTION_READ_MS;
    const buttonDelay = Math.floor(Math.random() * (MAX_BUTTON_DELAY_MS - MIN_BUTTON_DELAY_MS + 1)) + MIN_BUTTON_DELAY_MS;

    // increment roundSequence to avoid stale events
    state.roundSequence = (state.roundSequence || 0) + 1;
    state.questionReadEndsAt = Date.now() + readMs;
    await saveGameState(code, state);

    ioInstance.to(code).emit("round:showQuestion", {
      roundSequence: state.roundSequence,
      questionText: q.question,
      readMs,
    });

    // schedule openButton after readMs + buttonDelay
    scheduleTimer(`${code}:openButton:${state.roundSequence}`, async () => {
      await resetFirstPress(code);
      ioInstance.to(code).emit("round:openButton", { roundSequence: state.roundSequence, pressWindowMs: PRESS_WINDOW_MS });

      // schedule fallback if nobody presses
      scheduleTimer(`${code}:pressWindow:${state.roundSequence}`, async () => {
        await resetFirstPress(code);
        await handleNoPresses(code, ioInstance, state.roundSequence);
      }, PRESS_WINDOW_MS + 50);
    }, readMs + buttonDelay);
  }
  
  async function handleNoPresses(code: string, ioInstance: Server, roundSequence: number) {
    const state = await getGameState(code);
    if (!state || state.roundSequence !== roundSequence) return;
    const trivia = await Trivia.findById(state.triviaId).lean();
    if (!trivia || !Array.isArray(trivia.questions)) return;
    const q = trivia.questions[state.currentQuestionIndex];

    ioInstance.to(code).emit("round:result", {
      roundSequence,
      resolvedBy: null,
      correct: null,
      message: "Nadie presionó el botón. Se revela la respuesta",
      correctAnswer: q.correctAnswer,
      scores: state.scores,
    });

    state.blocked = {};
    state.currentQuestionIndex += 1;
    await saveGameState(code, state);

    // next round or end
    setTimeout(async () => {
      const triviaDoc = await Trivia.findById(state.triviaId).lean();
      if (!triviaDoc || !Array.isArray(triviaDoc.questions) || state.currentQuestionIndex >= triviaDoc.questions.length) {
        await endGame(code, ioInstance);
      } else {
        await startRound(code, ioInstance);
      }
    }, 1200);
  }

  // Button press by a player
  socket.on("round:buttonPress", async ({ code, roundSequence, eventId }, ack) => {
    try {
      const user = socket.data.user;

      // Dedupe para evitar dobles eventos
      if (eventId) {
        const ok = await dedupeEvent(code, eventId);
        if (!ok) return ack?.({ ok: true, message: "Evento duplicado ignorado" });
      }

      const state = await getGameState(code);
      if (!state) return ack?.({ ok: false, message: "No game state" });
      if (roundSequence !== state.roundSequence)
        return ack?.({ ok: false, message: "Stale round" });
      if (state.blocked[user.id])
        return ack?.({ ok: false, message: "Estás bloqueado para esta pregunta" });

      // Intento de reclamar el botón de manera atómica
      const claimed = await attemptFirstPress(code, user.id, PRESS_WINDOW_MS);
      if (!claimed)
        return ack?.({ ok: false, message: "Otro jugador ganó el botón" });

      // Jugador ganó el botón: bloquear al resto
      state.blocked = {};
      state.players.forEach((p) => {
        state.blocked[p.userId] = p.userId !== user.id;
      });
      await saveGameState(code, state);

      io.to(code).emit("round:playerWonButton", {
        roundSequence,
        playerId: user.id,
        name: user.name,
      });

      // Obtener la pregunta actual
      const trivia = await Trivia.findById(state.triviaId).lean();
      const q = trivia?.questions[state.currentQuestionIndex];
      if (!q) throw new Error("Question not found");

      // --- 🔧 NUEVA LÓGICA DE SINCRONIZACIÓN DE TIEMPO ---
      const now = Date.now();
      state.answerWindowEndsAt = now + ANSWER_TIMEOUT_MS;
      await saveGameState(code, state);

      // Timer del servidor (timeout de respuesta)
      const answerTimeoutKey = `${code}:answerTimeout:${state.roundSequence}`;
      scheduleTimer(
        answerTimeoutKey,
        async () => {
          await handleWinnerTimeout(code, io, state.roundSequence, user.id);
        },
        ANSWER_TIMEOUT_MS
      );

      // Enviar la ventana de respuesta sincronizada al cliente
      socket.emit("round:answerRequest", {
        roundSequence: state.roundSequence,
        options: q.options,
        answerTimeoutMs: ANSWER_TIMEOUT_MS,
        endsAt: state.answerWindowEndsAt, // 🕒 sincronización precisa
      });

      ack?.({ ok: true, message: "You pressed first" });
    } catch (err: any) {
      console.error("round:buttonPress", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  async function handleWinnerTimeout(
    code: string,
    ioInstance: Server,
    roundSequence: number,
    userId: string
  ) {
    const state = await getGameState(code);
    if (!state || state.roundSequence !== roundSequence) return;

    // 🔍 Revisar si el tiempo real ya venció según answerWindowEndsAt
    const now = Date.now();
    if (state.answerWindowEndsAt && now < state.answerWindowEndsAt) {
      // Todavía no se acabó el tiempo real → reprogramar el timer restante
      const remaining = state.answerWindowEndsAt - now;
      console.log(
        `[handleWinnerTimeout] Tiempo aún no vencido, reprogramando en ${remaining}ms`
      );

      scheduleTimer(
        `${code}:answerTimeout:${roundSequence}`,
        async () => {
          await handleWinnerTimeout(code, ioInstance, roundSequence, userId);
        },
        remaining
      );
      return;
    }

    // 🔔 Tiempo efectivamente expirado
    state.blocked[userId] = true;
    await saveGameState(code, state);

    ioInstance.to(code).emit("round:result", {
      roundSequence,
      playerId: userId,
      correct: false,
      message: "⏰ Se acabó el tiempo para responder",
    });

    await resetFirstPress(code);

    // Pequeña pausa antes de reabrir el botón
    setTimeout(() => startRoundOpenButtonAgain(code, ioInstance, roundSequence), 1200);
  }

  async function startRoundOpenButtonAgain(code: string, ioInstance: Server, roundSequence: number) {
    const state = await getGameState(code);
    if (!state || state.roundSequence !== roundSequence) return;

    const eligible = state.players.filter(p => !state.blocked[p.userId]);
    if (eligible.length === 0) {
      await handleNoPresses(code, ioInstance, roundSequence);
      return;
    }

    await resetFirstPress(code);
    ioInstance.to(code).emit("round:openButton", { roundSequence, pressWindowMs: PRESS_WINDOW_MS });
    scheduleTimer(`${code}:pressWindow:${roundSequence}`, async () => {
      await resetFirstPress(code);
      await handleNoPresses(code, ioInstance, roundSequence);
    }, PRESS_WINDOW_MS + 50);
  }

  // Winner submits answer
  socket.on("round:answer", async ({ code, roundSequence, selectedIndex, eventId }, ack) => {
    try {
      const user = socket.data.user;
      // dedupe
      if (eventId) {
        const ok = await dedupeEvent(code, eventId);
        if (!ok) return ack?.({ ok: true, message: "Evento duplicado ignorado" });
      }
      const state = await getGameState(code);
      if (!state || state.roundSequence !== roundSequence) return ack?.({ ok: false, message: "Round mismatch" });

      // check firstPress key equals this user
      const first = await redis.get(`room:${code}:firstPress`);
      if (first !== user.id) return ack?.({ ok: false, message: "No eres quien está respondiendo" });

      const trivia = await Trivia.findById(state.triviaId).lean();
      const q = trivia?.questions[state.currentQuestionIndex];

      const option = q?.options[selectedIndex];
      const correct = option === q?.correctAnswer || q?.correctAnswer === option; // adapt to your storage

      // stop answer timeout timer
      clearTimer(`${code}:answerTimeout:${roundSequence}`);

      if (correct) {
        // compute score
        const base = 100; // could be more complex (time-based, difficulty-based, etc)
        state.scores[user.id] = (state.scores[user.id] || 0) + base;
        // broadcast result
        io.to(code).emit("round:result", {
          roundSequence,
          playerId: user.id,
          correct: true,
          correctAnswer: q?.correctAnswer,
          scores: state.scores,
        });

        // reset blocked for next question
        state.blocked = {};
        state.currentQuestionIndex += 1;
        await saveGameState(code, state);

        // schedule next round
        setTimeout(() => startRound(code, io), 1500);
        return ack?.({ ok: true, correct: true });
      } else {
        // incorrect -> block this user, reopen button for others
        state.blocked[user.id] = true;
        await saveGameState(code, state);

        io.to(code).emit("round:result", { roundSequence, playerId: user.id, correct: false, message: "Incorrect answer" });

        // remove firstPress and reopen button for others
        await resetFirstPress(code);
        setTimeout(() => startRoundOpenButtonAgain(code, io, roundSequence), 800);

        return ack?.({ ok: true, correct: false });
      }
    } catch (err:any) {
      console.error("round:answer", err);
      ack?.({ ok: false, error: err.message });
    }
  });

  async function endGame(code: string, ioInstance: Server) {
    const state = await getGameState(code);
    if (!state) {
      console.warn(`[endGame] Estado no encontrado para la sala ${code}`);
      return;
    }

    if (!state.scores || !state.players) {
      console.warn(`[endGame] Estado incompleto en la sala ${code}`);
      return;
    }

    const existing = await GameResult.findOne({ roomCode: code });
    if (existing) {
      console.log(`[endGame] La partida ${code} ya fue persistida`);
      return;
    }

    state.status = "finished";
    await saveGameState(code, state);

    try {
      const sortedPlayers = Object.entries(state.scores)
        .map(([userId, score]) => {
          const player = state.players.find((p) => p.userId === userId);
          return { userId, name: player?.name || "Desconocido", score };
        })
        .sort((a, b) => b.score - a.score);

      const winner = sortedPlayers[0];

      await GameResult.create({
        roomCode: code,
        triviaId: state.triviaId,
        finishedAt: new Date(),
        scores: state.scores,
        players: sortedPlayers,
        winner,
      });

      // Marcar sala como finalizada
      await Room.findOneAndUpdate({ code }, { status: "finished" }).exec();

      ioInstance.to(code).emit("game:ended", {
        scores: state.scores,
        winner,
      });

      console.log(`✅ Partida ${code} finalizada. Ganador: ${winner?.name} (${winner?.score} pts)`);
    } catch (err) {
      console.error("[endGame] Error al guardar resultado", err);
    }
  }

  // ------------- disconnect -------------
  socket.on("disconnect", async () => {
    if (!currentRoom) return;
    const user = socket.data.user;
    io.to(currentRoom).emit("room:update", { event: "playerLeft", userId: user.id });
    console.log(`🔴 ${user.name} disconnected from ${currentRoom}`);
  });

}