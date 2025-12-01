import { z } from "zod";

export const generateTriviaSchema = z.object({
  topic: z.string().min(1).max(200),
  quantity: z.number().int().min(5).max(20).optional().default(5),
});
