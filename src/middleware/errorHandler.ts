import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    // Use logger to log the error stack (in test mode, logger passes arguments to console.error, mimicking legacy behavior)
    logger.error(err?.stack || String(err));
       const status = err?.status || 500;
       const message = err?.message || 'Internal Server Error';
       const details = err?.details || undefined;
       const payload: any = { error: message, message };
       if (details) payload.details = details;
       return res.status(status).json(payload);
};