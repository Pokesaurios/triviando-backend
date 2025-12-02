import type { Server } from "socket.io";
import { Types } from "mongoose";
import { Trivia } from "../models/trivia.model";
import { GameResult } from "../models/gameResult.model";
import {
  getGameState,
  saveGameState,
  clearAnswerWindow,
  resetFirstPress,
  PRESS_WINDOW_MS,
  DEFAULT_QUESTION_READ_MS,
  MIN_BUTTON_DELAY_MS,
  MAX_BUTTON_DELAY_MS,
  scheduleTimer,
} from "./game.service";
import logger from "../utils/logger";
import redis from "../config/redis";

export async function handleWinnerTimeoutSafe(io: Server, code: string, roundSequence: number, userId: string) {
  const state = await getGameState(code);
  if (!state || state.roundSequence !== roundSequence) return;

  const now = Date.now();
  if (state.answerWindowEndsAt && now < state.answerWindowEndsAt) {
    // Otro job reprogramará si aún no expira; aquí no hacemos nada para evitar duplicados.
    return;
  }

  // Marcar resultado por timeout
  await finalizeResultState(io, code, state, userId, "⏰ Se acabó el tiempo para responder");

  // Reabrir botón (bloqueando al que ganó el botón previamente)
  setTimeout(() => startRoundOpenButtonAgain(io, code, roundSequence), 1200);
}

async function finalizeResultState(io: Server, code: string, state: any, blockingUserId?: string, message?: string) {
  state.status = "result";
  state.blocked = {};
  if (blockingUserId) {
    state.players.forEach((p: any) => {
      state.blocked[p.userId] = p.userId === blockingUserId;
    });
  }
  clearAnswerWindow(state);
  await saveGameState(code, state);
  io.to(code).emit('game:update', state);
  if (message) {
    io.to(code).emit("round:result", {
      roundSequence: state.roundSequence,
      playerId: blockingUserId,
      correct: false,
      message,
      scores: state.scores,
    });
  }
  await resetFirstPress(code);
}

async function startRoundOpenButtonAgain(io: Server, code: string, roundSequence: number) {
  const state = await getGameState(code);
  if (!state || state.roundSequence !== roundSequence) return;

  const eligible = state.players.filter((p: any) => !state.blocked[p.userId]);
  if (eligible.length === 0) {
    await handleNoPresses(io, code, roundSequence);
    return;
  }

  await resetFirstPress(code);
  state.status = "open";
  await saveGameState(code, state);
  io.to(code).emit('game:update', state);
  io.to(code).emit("round:openButton", { roundSequence, pressWindowMs: PRESS_WINDOW_MS });

  // Fallback por si nadie presiona
  scheduleTimer(`${code}:pressWindow:${roundSequence}`, async () => {
    // Guard: only if still open and nobody won the button
    const latest = await getGameState(code);
    if (!latest || latest.roundSequence !== roundSequence) return;
    if (latest.status !== 'open' || typeof latest.answerWindowEndsAt === 'number') return;
    const first = await redis.get(`room:${code}:firstPress`);
    if (first) return;
    await resetFirstPress(code);
    await handleNoPresses(io, code, roundSequence);
  }, PRESS_WINDOW_MS + 50);
}

async function handleNoPresses(io: Server, code: string, roundSequence: number) {
  const state = await getGameState(code);
  if (!state || state.roundSequence !== roundSequence) return;

  const trivia = await Trivia.findById(state.triviaId).lean();
  if (!Array.isArray(trivia?.questions)) return;
  const q = trivia!.questions[state.currentQuestionIndex];
  if (!q) return;

  io.to(code).emit("round:result", {
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
  io.to(code).emit('game:update', state);

  setTimeout(async () => {
    const triviaDoc = await Trivia.findById(state.triviaId).lean();
    const hasMore = !!(triviaDoc && Array.isArray(triviaDoc.questions) && state.currentQuestionIndex < Math.max(0, triviaDoc.questions.length - 1));
    if (!hasMore) {
      await endGame(io, code);
    } else {
      await startRound(io, code);
    }
  }, 1200);
}

async function startRound(io: Server, code: string) {
  const state = await getGameState(code);
  if (!state) return;
  const trivia = await Trivia.findById(state.triviaId).lean();
  if (!trivia) return;

  const q = trivia.questions[state.currentQuestionIndex];
  if (!q) {
    await endGame(io, code);
    return;
  }
  const readMs = DEFAULT_QUESTION_READ_MS;
  const buttonDelay = Math.floor(Math.random() * (MAX_BUTTON_DELAY_MS - MIN_BUTTON_DELAY_MS + 1)) + MIN_BUTTON_DELAY_MS;

  state.roundSequence = (state.roundSequence || 0) + 1;
  state.questionReadEndsAt = Date.now() + readMs;
  clearAnswerWindow(state);
  state.status = "reading";
  await saveGameState(code, state);
  io.to(code).emit('game:update', state);

  io.to(code).emit("round:showQuestion", {
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
    io.to(code).emit('game:update', s);
    io.to(code).emit("round:openButton", { roundSequence: state.roundSequence, pressWindowMs: PRESS_WINDOW_MS });

    scheduleTimer(`${code}:pressWindow:${state.roundSequence}`, async () => {
      const latest = await getGameState(code);
      if (!latest || latest.roundSequence !== state.roundSequence) return;
      if (latest.status !== 'open' || typeof latest.answerWindowEndsAt === 'number') return;
      const first = await redis.get(`room:${code}:firstPress`);
      if (first) return;
      await resetFirstPress(code);
      await handleNoPresses(io, code, state.roundSequence);
    }, PRESS_WINDOW_MS + 50);
  }, readMs + buttonDelay);
}

async function endGame(io: Server, code: string) {
  const state = await getGameState(code);
  if (!state) return;

  // Evitar duplicados
  const existing = await GameResult.findOne({ roomCode: code });
  if (existing) return;

  // Verificar desempate con pregunta de reserva
  const triviaDoc = await Trivia.findById(state.triviaId).lean();
  const sortedPlayers = Object.entries(state.scores || {})
    .map(([userId, score]) => {
      const player = state.players.find((p: any) => p.userId === userId);
      return { userId, name: player?.name || "Desconocido", score: score as number };
    })
    .sort((a, b) => (b.score as number) - (a.score as number));

  const tie = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;
  const spareIndex = Array.isArray(triviaDoc?.questions) ? triviaDoc!.questions.length - 1 : -1;
  if (tie && spareIndex >= 0 && !state.tieBreakerPlayed) {
    state.status = "in-game";
    state.tieBreakerPlayed = true;
    state.currentQuestionIndex = spareIndex;
    await saveGameState(code, state);
    await startRound(io, code);
    return;
  }

  const winner = sortedPlayers[0];
  const triviaIdForSave = (() => {
    if (typeof state.triviaId === 'string') {
      return Types.ObjectId.isValid(state.triviaId) ? new Types.ObjectId(state.triviaId) : state.triviaId;
    }
    return state.triviaId;
  })();

  state.status = "finished";
  await saveGameState(code, state);

  try {
    await GameResult.create({
      roomCode: code,
      triviaId: triviaIdForSave,
      finishedAt: new Date(),
      scores: state.scores,
      winner: winner ? { userId: winner.userId, name: (winner as any).name, score: winner.score } : undefined,
    } as any);
  } catch (err: any) {
    logger.error({ err: err?.message || err, code }, "endGame: error al guardar resultado");
  }

  io.to(code).emit("game:finished", { scores: state.scores, winner });
}

// Export internals for testing
export { startRound, handleNoPresses, endGame, startRoundOpenButtonAgain };
