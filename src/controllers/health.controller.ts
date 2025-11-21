import { Request, Response } from "express";
import mongoose from "mongoose";
import redis from "../config/redis";

/**
 * Health check endpoint for load balancer
 * Returns 200 if all services are healthy, 503 if any service is down
 */
export const healthCheck = async (_req: Request, res: Response) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: "ok",
      database: "unknown",
      redis: "unknown",
    },
  };

  let httpStatus = 200;

  // Check MongoDB connection
  try {
    const dbState = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    if (dbState === 1) {
      health.services.database = "ok";
    } else {
      health.services.database = "degraded";
      health.status = "degraded";
      httpStatus = 503;
    }
  } catch {
    health.services.database = "error";
    health.status = "error";
    httpStatus = 503;
  }

  // Check Redis connection
  try {
    await redis.ping();
    health.services.redis = "ok";
  } catch {
    health.services.redis = "error";
    health.status = "error";
    httpStatus = 503;
  }

  res.status(httpStatus).json(health);
};

/**
 * Simple liveness probe for Kubernetes/container orchestrators
 * Returns 200 if the process is alive
 */
export const livenessProbe = (_req: Request, res: Response) => {
  res.status(200).json({ status: "alive" });
};

/**
 * Readiness probe for Kubernetes/container orchestrators
 * Returns 200 if the service is ready to accept traffic
 */
export const readinessProbe = async (_req: Request, res: Response) => {
  try {
    // Check if critical services are available
    const dbReady = mongoose.connection.readyState === 1;
    const redisReady = await redis.ping().then(() => true).catch(() => false);

    if (dbReady && redisReady) {
      res.status(200).json({ status: "ready" });
    } else {
      res.status(503).json({ 
        status: "not ready",
        services: {
          database: dbReady ? "ready" : "not ready",
          redis: redisReady ? "ready" : "not ready",
        }
      });
    }
  } catch {
    res.status(503).json({ status: "not ready", error: "Service check failed" });
  }
};
