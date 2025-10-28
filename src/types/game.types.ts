export type PlayerScore = {
    userId: string;
    name : string;
    score: number;
    blocked?: boolean;
}

export interface GameState {
    roomCode: string;
    triviaId: string;
    status: 'waiting' | 'in-progress' | 'finished';
    currentQuestionIndex: number;
    roundSequence: number;
    scores: Record<string, number>; // userId to score mapping
    blocked: Record<string, boolean>; // userId to blocked status mapping
    players: PlayerScore[];
    questionReadEndsAt?: number; // timestamp
    answerWindowEndsAt?: number; // timestamp
}
