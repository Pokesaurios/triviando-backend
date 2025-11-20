import redis from "../config/redis";
import { Trivia } from "../models/trivia.model";
import { GameState } from "../types/game.types";
import { setNxPx } from "../utils/redisHelpers";

const GAME_PREFIX = (code: string) => `room:${code}:game`;
const FIRST_PRESS_KEY = (code: string) => `room:${code}:firstPress`;
const EVENT_SET_KEY = (code: string) => `room:${code}:eventIds`;

export const DEFAULT_QUESTION_READ_MS = 10000;
export const MIN_BUTTON_DELAY_MS = 1000;
export const MAX_BUTTON_DELAY_MS = 5000;
export const PRESS_WINDOW_MS = 10000;
export const ANSWER_TIMEOUT_MS = 15000;
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
      console.error(`[game.service] Corrupted game state in redis for ${code}. raw.len=${raw.length} snippet=${snippet}`, e);
      // Increment a counter to surface repeated corruptions and set an expiry for the metric
      try {
        await redis.incr(`${GAME_PREFIX(code)}:corrupt_count`);
        await redis.expire(`${GAME_PREFIX(code)}:corrupt_count`, 60 * 60 * 24); // 1 day
      } catch (metricErr) {
        console.warn(`[game.service] Failed to increment corrupt_count for ${code}:`, metricErr);
      }
    } catch (logErr) {
      console.error(`[game.service] Error while logging corrupted game state for ${code}:`, logErr);
    }

    // clear corrupted state to avoid loops
    try {
      await redis.del(GAME_PREFIX(code));
    } catch (delErr) {
      console.error(`[game.service] Failed to delete corrupted game state for ${code}:`, delErr);
    }

    return null;
  }
}

export async function saveGameState(code: string, state: GameState) {
  await redis.set(GAME_PREFIX(code), JSON.stringify(state));
}

export function clearAnswerWindow(state: GameState) {
  state.answerWindowEndsAt = undefined;
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
      console.error("[scheduleTimer] error:", e);
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
