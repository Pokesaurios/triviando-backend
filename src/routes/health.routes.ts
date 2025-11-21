import { Router } from "express";
import { healthCheck, livenessProbe, readinessProbe } from "../controllers/health.controller";

const router = Router();

/**
 * @route   GET /health
 * @desc    Comprehensive health check for load balancer
 * @access  Public
 */
router.get("/health", healthCheck);

/**
 * @route   GET /health/live
 * @desc    Liveness probe (process is alive)
 * @access  Public
 */
router.get("/health/live", livenessProbe);

/**
 * @route   GET /health/ready
 * @desc    Readiness probe (service is ready to accept traffic)
 * @access  Public
 */
router.get("/health/ready", readinessProbe);

export default router;
