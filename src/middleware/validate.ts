import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateBody = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    return next();
  } catch (err) {
    let details: any[] = [];
    if (err instanceof ZodError) {
      details = err.issues;
    } else {
      details = [{ message: (err as Error)?.message || 'Unknown error' }];
    }
    return res.status(400).json({ message: "Invalid request body", details });
  }
};

export const validateParams = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.params);
    req.params = parsed;
    return next();
  } catch (err) {
    let details: any[] = [];
    if (err instanceof ZodError) {
      details = err.issues;
    } else {
      details = [{ message: (err as Error)?.message || 'Unknown error' }];
    }
    return res.status(400).json({ message: "Invalid request params", details });
  }
};
