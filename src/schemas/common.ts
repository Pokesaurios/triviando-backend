import { z } from "zod";

// Empty object schema (useful for routes that don't accept body)
export const emptyObjectSchema = z.object({}).strict();

// Allows any payload (useful for marking socket handlers as 'validated')
export const anySchema = z.any();

export default {};
