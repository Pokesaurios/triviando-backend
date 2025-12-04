import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateBody = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request body", message: "Invalid request body", details: err.issues });
    }
    return res.status(400).json({ error: "Invalid request body", message: "Invalid request body", details: [{ message: (err as Error)?.message || 'Unknown error' }] });
  }
};

export const validateParams = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.params);
    req.params = parsed;
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request params", message: "Invalid request params", details: err.issues });
    }
    return res.status(400).json({ error: "Invalid request params", message: "Invalid request params", details: [{ message: (err as Error)?.message || 'Unknown error' }] });
  }
};

export const validateQuery = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.query);
    // NOTE: Express query parsing always produces strings or arrays; keep parsed in a separate property
    (req as any).validatedQuery = parsed;
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request query", message: "Invalid request query", details: err.issues });
    }
    return res.status(400).json({ error: "Invalid request query", message: "Invalid request query", details: [{ message: (err as Error)?.message || 'Unknown error' }] });
  }
};
