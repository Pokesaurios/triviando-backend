import redis from "../config/redis";
import { Trivia } from "../models/trivia.model";
import { GameState } from "../types/game.types";
import { setNxPx } from "../utils/redisHelpers";
import logger from "../utils/logger";
import { scheduleTimerJob, removeTimerJob } from "../queues/timers.queue";

const GAME_PREFIX = (code: string) => `room:${code}:game`;
const FIRST_PRESS_KEY = (code: string) => `room:${code}:firstPress`;
const EVENT_SET_KEY = (code: string) => `room:${code}:eventIds`;

export const DEFAULT_QUESTION_READ_MS = 10000;
export const MIN_BUTTON_DELAY_MS = 1000;
export const MAX_BUTTON_DELAY_MS = 5000;
export const PRESS_WINDOW_MS = 10000;
export const ANSWER_TIMEOUT_MS = 20000;
export const ANSWER_BASE_SCORE = 100;
export const ANSWER_SPEED_BONUS_MAX = 50; // maximum extra points for fastest answers
export const MAX_LOG_SNIPPET_LENGTH = 200;

export async function initGameState(
  code: string,
  triviaId: string,
  players: { userId: string; name: string }[]
) {
  const trivia = await Trivia.findById(triviaId).lean();
  if (!trivia) throw new Error("Trivia not found");

  const initialScores: Record<string, number> = {};
  players.forEach((p) => (initialScores[p.userId] = 0));

  const state: GameState = {
    roomCode: code,
    triviaId: triviaId.toString(),
    status: "in-game",
    currentQuestionIndex: 0,
    roundSequence: 0,
    scores: initialScores,
    blocked: {},
    players: players.map((p) => ({ userId: p.userId, name: p.name })),
  };

  await redis.set(GAME_PREFIX(code), JSON.stringify(state));
  return state;
}

export async function getGameState(code: string): Promise<GameState | null> {
  const raw = await redis.get(GAME_PREFIX(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch (e) {
    // Enhanced logging for debugging/monitoring: include truncated raw payload, length and increment a corruption counter in redis
    try {
      const snippet = raw.length > MAX_LOG_SNIPPET_LENGTH ? raw.slice(0, MAX_LOG_SNIPPET_LENGTH) + '...[truncated]' : raw;
      logger.error({ code, rawLen: raw.length, snippet, err: (e as any)?.message || e }, 'Corrupted game state in redis');
      // Increment a counter to surface repeated corruptions and set an expiry for the metric
      try {
        await redis.incr(`${GAME_PREFIX(code)}:corrupt_count`);
        await redis.expire(`${GAME_PREFIX(code)}:corrupt_count`, 60 * 60 * 24); // 1 day
      } catch (metricErr) {
        logger.warn({ code, err: (metricErr as any)?.message || metricErr }, 'Failed to increment corrupt_count for code');
      }
    } catch (logErr) {
      logger.error({ code, err: (logErr as any)?.message || logErr }, 'Error while logging corrupted game state');
    }

    // clear corrupted state to avoid loops
    try {
      await redis.del(GAME_PREFIX(code));
    } catch (delErr) {
      logger.error({ code, err: (delErr as any)?.message || delErr }, 'Failed to delete corrupted game state');
    }

    return null;
  }
}

export async function saveGameState(code: string, state: GameState) {
  await redis.set(GAME_PREFIX(code), JSON.stringify(state));
}

export function clearAnswerWindow(state: GameState) {
  state.answerWindowEndsAt = undefined;
  state.answerWindowStartedAt = undefined;
}

/* In-memory timers for MVP (single instance)
   Key naming: `${code}:timers:${type}:${roundSequence}` */
export const timersMap = new Map<string, NodeJS.Timeout>();

export function scheduleTimer(key: string, fn: () => void, delayMs: number) {
  clearTimer(key);
  const t = setTimeout(async () => {
    timersMap.delete(key);
    try {
      await fn();
    } catch (e) {
      logger.error({ err: (e as any)?.message || e, key }, 'scheduleTimer error');
    }
  }, delayMs);
  timersMap.set(key, t);
}

export function clearTimer(key: string) {
  const t = timersMap.get(key);
  if (t) {
    clearTimeout(t);
    timersMap.delete(key);
  }
}

// Returns true if this was the first press, false otherwise
export async function attemptFirstPress(code: string, userId: string, pressWindowMs = PRESS_WINDOW_MS) {
  const key = FIRST_PRESS_KEY(code);
  // returns "OK" when set, null if not set
  const res = await setNxPx(key, userId, pressWindowMs);
  return res === "OK";
}

export async function resetFirstPress(code: string) {
  await redis.del(FIRST_PRESS_KEY(code));
}

// Event dedupe: returns true if first time (process it), false if duplicate (ignore)
export async function dedupeEvent(code: string, eventId: string, ttlSec = 10) {
  if (!eventId) return true;
  const key = EVENT_SET_KEY(code);
  const added = await redis.sadd(key, eventId);
  if (added === 1) {
    await redis.expire(key, ttlSec);
    return true;
  }
  return false;
}

// ---------- Distributed timers (BullMQ) helpers ----------
export async function scheduleDistributedAnswerTimeout(jobId: string, payload: any, delayMs: number) {
  // In tests or if REDIS_URL is not configured, skip queuing to avoid opening handles
  if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) {
    return;
  }
  await scheduleTimerJob(jobId, 'answerTimeout', delayMs, payload);
}

export async function clearDistributedTimer(jobId: string) {
  if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) {
    return;
  }
  await removeTimerJob(jobId);
}
