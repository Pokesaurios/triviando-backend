// Tipos para que el frontend valide eventos y payloads recibidos por WebSocket
export type PlayerInfo = {
  userId: string;
  name: string;
};

export interface GameState {
  roomCode: string;
  triviaId: string;
  status: 'waiting' | 'in-game' | 'finished' | 'open' | 'result' | 'reading' | 'answering';
  currentQuestionIndex: number;
  roundSequence: number;
  scores: Record<string, number>;
  blocked: Record<string, boolean>;
  players: PlayerInfo[];
  questionReadEndsAt?: number; // timestamp ms
  answerWindowEndsAt?: number; // timestamp ms
  answerWindowStartedAt?: number; // timestamp ms
  tieBreakerPlayed?: boolean;
}

// Eventos / payloads
export interface RoundShowQuestionPayload {
  roundSequence: number;
  questionText: string;
  readMs: number; // ms
}

export interface RoundOpenButtonPayload {
  roundSequence: number;
  pressWindowMs: number; // ms
}

export interface RoundAnswerRequestPayload {
  roundSequence: number;
  options: string[];
  answerTimeoutMs: number; // ms
  endsAt: number; // timestamp ms (source of truth)
}

export interface RoundResultPayload {
  roundSequence: number;
  playerId?: string | null;
  resolvedBy?: string | null;
  correct?: boolean | null;
  message?: string;
  correctAnswer?: string | null;
  scores?: Record<string, number>;
  responseTimeMs?: number;
  bonus?: number;
  base?: number;
}

export interface GameStartedPayload { ok: true; totalQuestions: number }

export interface GameEndedPayload {
  scores: Record<string, number>;
  winner?: { userId: string; name: string; score: number };
}

// Map of event names to payloads (for reference)
export type ServerToClientEvents = {
  'game:started': (payload: GameStartedPayload) => void;
  'round:showQuestion': (p: RoundShowQuestionPayload) => void;
  'round:openButton': (p: RoundOpenButtonPayload) => void;
  'round:playerWonButton': (p: { roundSequence: number; playerId: string; name: string }) => void;
  'round:answerRequest': (p: RoundAnswerRequestPayload) => void;
  'round:result': (p: RoundResultPayload) => void;
  'game:update': (state: GameState) => void;
  'game:ended': (p: GameEndedPayload) => void;
};

export type ClientToServerEvents = {
  'game:start': (payload: { code: string }) => void;
  'round:buttonPress': (payload: { code: string; roundSequence: number; eventId?: string }) => void;
  'round:answer': (payload: { code: string; roundSequence: number; selectedIndex: number; eventId?: string }) => void;
};

export {};
