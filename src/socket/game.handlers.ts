import { Server, Socket } from "socket.io";
import { Room } from "../models/room.model";
import { Trivia } from "../models/trivia.model";
import redis from "../config/redis";
import {
  initGameState,
  getGameState,
  saveGameState,
  scheduleTimer,
  clearTimer,
  attemptFirstPress,
  resetFirstPress,
  dedupeEvent,
  clearAnswerWindow,
  DEFAULT_QUESTION_READ_MS,
  MAX_BUTTON_DELAY_MS,
  MIN_BUTTON_DELAY_MS,
  PRESS_WINDOW_MS,
  ANSWER_TIMEOUT_MS,
} from "../services/game.service";
import { GameResult } from "../models/gameResult.model";
import logger from "../utils/logger";

export function registerGameHandlers(io: Server, socket: Socket) {
  // ------------- game:start -------------
  socket.on("game:start", async ({ code }, ack) => {
    try {
      const user = socket.data.user;
      if (!code) return ack?.({ ok: false, message: "Room code required" });

      const room = await Room.findOne({ code }).lean();
      if (!room) return ack?.({ ok: false, message: "Room not found" });
      if (room.hostId.toString() !== user.id) {
        logger.warn({ socketId: socket.id, code, userId: user.id }, "Unauthorized attempt to start game - not host");
        return ack?.({ ok: false, message: "Only host can start the game" });
      }

      await Room.findOneAndUpdate({ code }, { status: "in-game" }).exec();

      const players = room.players.map((p: any) => ({ userId: p.userId.toString(), name: p.name }));
      await initGameState(code, room.triviaId.toString(), players);

      const triviaDoc = await Trivia.findById(room.triviaId).lean();
      const totalQuestions = Array.isArray(triviaDoc?.questions) && triviaDoc.questions.length > 0
        ? Math.max(0, triviaDoc.questions.length - 1)
        : 0;
      io.to(code).emit("game:started", { ok: true, totalQuestions });

      await startRound(code, io);

      ack?.({ ok: true });
    } catch (err: any) {
      logger.error({ err: err?.message || err, socketId: socket.id, code: typeof code === 'string' ? code : 'unknown' }, "game:start error");
      ack?.({ ok: false, error: err.message });
    }
  });

  // Button press by a player
  socket.on("round:buttonPress", async ({ code, roundSequence, eventId }, ack) => {
    try {
      const user = socket.data.user;

      if (eventId) {
        const ok = await dedupeEvent(code, eventId);
        if (!ok) return ack?.({ ok: true, message: "Evento duplicado ignorado" });
      }

      const state = await getGameState(code);
      if (!state) return ack?.({ ok: false, message: "No game state" });
      if (roundSequence !== state.roundSequence)
        return ack?.({ ok: false, message: "Stale round" });
      if (state.blocked[user.id]) {
        logger.warn({ socketId: socket.id, code, userId: user.id }, "Blocked user attempted button press");
        return ack?.({ ok: false, code: 403, message: "Estás bloqueado para esta pregunta" });
      }

      const claimed = await attemptFirstPress(code, user.id, PRESS_WINDOW_MS);
      if (!claimed)
        return ack?.({ ok: false, message: "Otro jugador ganó el botón" });

      state.blocked = {};
      state.players.forEach((p) => {
        state.blocked[p.userId] = p.userId !== user.id;
      });
      state.status = "answering";
      await saveGameState(code, state);
      io.to(code).emit('game:update', state);

      io.to(code).emit("round:playerWonButton", {
        roundSequence,
        playerId: user.id,
        name: user.name,
      });

      const trivia = await Trivia.findById(state.triviaId).lean();
      const q = trivia?.questions[state.currentQuestionIndex];
      if (!q) throw new Error("Question not found");

      const now = Date.now();
      state.answerWindowEndsAt = now + ANSWER_TIMEOUT_MS;
      await saveGameState(code, state);
      io.to(code).emit('game:update', state);

      const answerTimeoutKey = `${code}:answerTimeout:${state.roundSequence}`;
      scheduleTimer(
        answerTimeoutKey,
        async () => {
          await handleWinnerTimeout(code, io, state.roundSequence, user.id);
        },
        ANSWER_TIMEOUT_MS
      );

      socket.emit("round:answerRequest", {
        roundSequence: state.roundSequence,
        options: q.options,
        answerTimeoutMs: ANSWER_TIMEOUT_MS,
        endsAt: state.answerWindowEndsAt,
      });

      ack?.({ ok: true, message: "You pressed first" });
    } catch (err: any) {
      logger.warn({ err: err?.message || err, socketId: socket.id, code: typeof code === 'string' ? code : 'unknown' }, "round:buttonPress error");
      ack?.({ ok: false, error: err.message });
    }
  });

  // Winner submits answer
  socket.on("round:answer", async ({ code, roundSequence, selectedIndex, eventId }, ack) => {
    try {
      const user = socket.data.user;
      if (eventId) {
        const ok = await dedupeEvent(code, eventId);
        if (!ok) return ack?.({ ok: true, message: "Evento duplicado ignorado" });
      }
      const state = await getGameState(code);
      if (!state || state.roundSequence !== roundSequence) return ack?.({ ok: false, message: "Round mismatch" });

      const first = await redis.get(`room:${code}:firstPress`);
      if (first !== user.id) {
        logger.warn({ socketId: socket.id, code, userId: user.id }, "Unauthorized answer attempt - not current responder");
        return ack?.({ ok: false, code: 403, message: "No eres quien está respondiendo" });
      }

      const trivia = await Trivia.findById(state.triviaId).lean();
      const q = trivia?.questions[state.currentQuestionIndex];

      const option = q?.options[selectedIndex];
      const correct = option === q?.correctAnswer || q?.correctAnswer === option;

      clearTimer(`${code}:answerTimeout:${roundSequence}`);

      if (correct) {
        const base = 100;
        state.scores[user.id] = (state.scores[user.id] || 0) + base;
        io.to(code).emit("round:result", {
          roundSequence,
          playerId: user.id,
          correct: true,
          correctAnswer: q?.correctAnswer,
          scores: state.scores,
        });

        state.status = "result";
        state.blocked = {};
        clearAnswerWindow(state);
        state.currentQuestionIndex += 1;
        await saveGameState(code, state);
        io.to(code).emit('game:update', state);

        const triviaDoc = await Trivia.findById(state.triviaId).lean();
        if (!triviaDoc || !Array.isArray(triviaDoc.questions) || state.currentQuestionIndex >= Math.max(0, triviaDoc.questions.length - 1)) {
          await endGame(code, io);
        } else {
          setTimeout(() => startRound(code, io), 1500);
        }
        return ack?.({ ok: true, correct: true });
      } else {
        await finalizeResultState(code, state, io, user.id);

        io.to(code).emit("round:result", { roundSequence, playerId: user.id, correct: false, message: "Incorrect answer", scores: state.scores });

        await resetFirstPress(code);
        setTimeout(() => startRoundOpenButtonAgain(code, io, roundSequence), 800);

        return ack?.({ ok: true, correct: false });
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err, socketId: socket.id, code: typeof code === 'string' ? code : 'unknown' }, "round:answer error");
      ack?.({ ok: false, error: err.message });
    }
  });

  async function startRound(code: string, ioInstance: Server) {
    const state = await getGameState(code);
    if (!state) return;
    const trivia = await Trivia.findById(state.triviaId).lean();
    if (!trivia) return;

    const q = trivia!.questions[state.currentQuestionIndex];
    if (!q) {
      await endGame(code, ioInstance);
      return;
    }
    const readMs = DEFAULT_QUESTION_READ_MS;
    const buttonDelay = Math.floor(Math.random() * (MAX_BUTTON_DELAY_MS - MIN_BUTTON_DELAY_MS + 1)) + MIN_BUTTON_DELAY_MS;

    state.roundSequence = (state.roundSequence || 0) + 1;
    state.questionReadEndsAt = Date.now() + readMs;
    clearAnswerWindow(state);
    state.status = "reading";
    await saveGameState(code, state);
    ioInstance.to(code).emit('game:update', state);

    ioInstance.to(code).emit("round:showQuestion", {
      roundSequence: state.roundSequence,
      questionText: q.question,
      readMs,
    });

    scheduleTimer(`${code}:openButton:${state.roundSequence}`, async () => {
      await resetFirstPress(code);
      const s = await getGameState(code);
      if (!s || s.roundSequence !== state.roundSequence) return;
      s.status = "open";
      await saveGameState(code, s);
      ioInstance.to(code).emit('game:update', s);

      ioInstance.to(code).emit("round:openButton", { roundSequence: state.roundSequence, pressWindowMs: PRESS_WINDOW_MS });

      scheduleTimer(`${code}:pressWindow:${state.roundSequence}`, async () => {
        await resetFirstPress(code);
        await handleNoPresses(code, ioInstance, state.roundSequence);
      }, PRESS_WINDOW_MS + 50);
    }, readMs + buttonDelay);
  }

  async function handleNoPresses(code: string, ioInstance: Server, roundSequence: number) {
    const state = await getGameState(code);
    if (state?.roundSequence !== roundSequence) return;

    const trivia = await Trivia.findById(state.triviaId).lean();
    if (!Array.isArray(trivia?.questions)) return;

    const q = trivia.questions?.[state.currentQuestionIndex];
    if (!q) return;

    ioInstance.to(code).emit("round:result", {
      roundSequence,
      resolvedBy: null,
      correct: null,
      message: "Nadie presionó el botón. Se revela la respuesta",
      correctAnswer: q.correctAnswer,
      scores: state.scores,
    });

    state.status = "result";
    state.blocked = {};
    clearAnswerWindow(state);
    state.currentQuestionIndex += 1;
    await saveGameState(code, state);
    ioInstance.to(code).emit('game:update', state);

    setTimeout(async () => {
      const triviaDoc = await Trivia.findById(state.triviaId).lean();
      if (!triviaDoc || !Array.isArray(triviaDoc.questions) || state.currentQuestionIndex >= Math.max(0, triviaDoc.questions.length - 1)) {
        await endGame(code, ioInstance);
      } else {
        await startRound(code, ioInstance);
      }
    }, 1200);
  }

  async function handleWinnerTimeout(
    code: string,
    ioInstance: Server,
    roundSequence: number,
    userId: string
  ) {
    const state = await getGameState(code);
    if (state?.roundSequence !== roundSequence) return;

    const now = Date.now();
    if (state.answerWindowEndsAt && now < state.answerWindowEndsAt) {
      const remaining = state.answerWindowEndsAt - now;
      scheduleTimer(
        `${code}:answerTimeout:${roundSequence}`,
        async () => {
          await handleWinnerTimeout(code, ioInstance, roundSequence, userId);
        },
        remaining
      );
      return;
    }

    await finalizeResultState(code, state, ioInstance, userId);

    ioInstance.to(code).emit("round:result", {
      roundSequence,
      playerId: userId,
      correct: false,
      message: "⏰ Se acabó el tiempo para responder",
      scores: state.scores,
    });

    await resetFirstPress(code);

    setTimeout(() => startRoundOpenButtonAgain(code, ioInstance, roundSequence), 1200);
  }

  async function finalizeResultState(code: string, state: any, ioInstance: Server, blockingUserId?: string) {
    state.status = "result";
    state.blocked = {};
    if (blockingUserId) {
      state.players.forEach((p: any) => {
        state.blocked[p.userId] = p.userId === blockingUserId;
      });
    }
    clearAnswerWindow(state);
    await saveGameState(code, state);
    ioInstance.to(code).emit('game:update', state);
  }

  async function startRoundOpenButtonAgain(code: string, ioInstance: Server, roundSequence: number) {
    const state = await getGameState(code);
    if (state?.roundSequence !== roundSequence) return;

    const eligible = state.players.filter(p => !state.blocked[p.userId]);
    if (eligible.length === 0) {
      await handleNoPresses(code, ioInstance, roundSequence);
      return;
    }
    await resetFirstPress(code);
    state.status = "open";
    await saveGameState(code, state);
    ioInstance.to(code).emit('game:update', state);
    ioInstance.to(code).emit("round:openButton", { roundSequence, pressWindowMs: PRESS_WINDOW_MS });
    scheduleTimer(`${code}:pressWindow:${roundSequence}`, async () => {
      await resetFirstPress(code);
      await handleNoPresses(code, ioInstance, roundSequence);
    }, PRESS_WINDOW_MS + 50);
  }

  async function endGame(code: string, ioInstance: Server) {
    const state = await getGameState(code);
    if (!state) {
      logger.warn({ code }, "endGame: estado no encontrado para la sala");
      return;
    }

    if (!state.scores || !state.players) {
      logger.warn({ code }, "endGame: estado incompleto en la sala");
      return;
    }

    const existing = await GameResult.findOne({ roomCode: code });
    if (existing) {
      return;
    }

    state.status = "finished";
    await saveGameState(code, state);

    try {
      const triviaDoc = await Trivia.findById(state.triviaId).lean();
      const sortedPlayers = Object.entries(state.scores)
        .map(([userId, score]) => {
          const player = state.players.find((p) => p.userId === userId);
          return { userId, name: player?.name || "Desconocido", score } as { userId: string; name: string; score: number };
        })
        .sort((a, b) => b.score - a.score);

      const tie = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;

      const spareIndex = Array.isArray(triviaDoc?.questions) ? triviaDoc.questions.length - 1 : -1;
      if (tie && spareIndex >= 0 && !state.tieBreakerPlayed) {
        state.status = "in-game";
        state.tieBreakerPlayed = true;
        state.currentQuestionIndex = spareIndex;
        await saveGameState(code, state);
        await startRound(code, ioInstance);
        return;
      }

      const winner = sortedPlayers[0];

      await GameResult.create({
        roomCode: code,
        triviaId: state.triviaId,
        finishedAt: new Date(),
        scores: state.scores,
        players: sortedPlayers,
        winner,
      });

      await Room.findOneAndUpdate({ code }, { status: "finished" }).exec();

      ioInstance.to(code).emit("game:ended", {
        scores: state.scores,
        winner,
      });

    } catch (err) {
      logger.error({ err: (err as any)?.message || err, code }, "endGame: error al guardar resultado");
    }
  }
}
