import { Router } from "express";
import { getGameResults, getGameResultByRoom } from "../controllers/gameResult.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateParams } from "../middleware/validate";
import { roomCodeParamSchema } from "../schemas/room";

const router = Router();

// Require authentication for game results endpoints
router.get("/", authMiddleware, getGameResults);
router.get("/:code", authMiddleware, validateParams(roomCodeParamSchema), getGameResultByRoom);

export default router;
