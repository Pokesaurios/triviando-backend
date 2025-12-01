import { Router } from "express";
import { getGameResults, getGameResultByRoom } from "../controllers/gameResult.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Require authentication for game results endpoints
router.get("/", authMiddleware, getGameResults);
router.get("/:code", authMiddleware, getGameResultByRoom);

export default router;
