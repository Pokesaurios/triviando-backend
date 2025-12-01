import { z } from "zod";

export const createRoomSchema = z.object({
  topic: z.string().min(1).max(200),
  maxPlayers: z.number().int().min(2).max(20).optional().default(4),
  quantity: z.number().int().min(5).max(20).optional().default(5),
});

export const joinRoomSchema = z.object({
  code: z.string().min(1, { message: 'Room code required' }).regex(/^[A-Za-z0-9_]+$/, { message: 'Invalid room code' }),
});

export const roomCodeParamSchema = z.object({
  code: z.string().min(1, { message: 'Room code required' }).regex(/^[A-Za-z0-9_]+$/, { message: 'Invalid room code' }),
});

export const chatSchema = z.object({
  code: z.string().min(1, { message: 'Room code required' }).regex(/^[A-Za-z0-9_]+$/, { message: 'Invalid room code' }),
  message: z.string().min(1).max(400, { message: 'Message exceeds maximum length of 400 characters' }),
});
