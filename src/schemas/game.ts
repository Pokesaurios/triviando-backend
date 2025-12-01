import { z } from "zod";

const roomCode = z.string().min(1, { message: 'Room code required' }).regex(/^[A-Za-z0-9_]+$/, { message: 'Invalid room code' });

export const gameStartSchema = z.object({
  code: roomCode,
});

export const buttonPressSchema = z.object({
  code: roomCode,
  roundSequence: z.number().int().min(0),
  eventId: z.string().optional(),
});

export const answerSchema = z.object({
  code: roomCode,
  roundSequence: z.number().int().min(0),
  selectedIndex: z.number().int().min(0),
  eventId: z.string().optional(),
});
