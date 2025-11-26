export type PlayerInfo = {
    userId: string;
    name : string;
}

export interface GameState {
    roomCode: string;
    triviaId: string;
    status: 'waiting' | 'in-game' | 'finished' | 'open' | 'result' | 'reading' | 'answering';
    currentQuestionIndex: number;
    roundSequence: number;
    scores: Record<string, number>; // userId to score mapping
    blocked: Record<string, boolean>; // userId to blocked status mapping
    players: PlayerInfo[];
    questionReadEndsAt?: number; // timestamp
    answerWindowEndsAt?: number; // timestamp
    tieBreakerPlayed?: boolean; // whether the spare tie-break question was used
}
