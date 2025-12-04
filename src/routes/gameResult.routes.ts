import { Router } from "express";
import { getGameResults, getGameResultByRoom } from "../controllers/gameResult.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateParams, validateQuery } from "../middleware/validate";
import { roomCodeParamSchema } from "../schemas/room";
import { emptyObjectSchema } from "../schemas/common";

const router = Router();

// Require authentication for game results endpoints
router.get("/", authMiddleware, validateQuery(emptyObjectSchema), getGameResults);
router.get("/:code", authMiddleware, validateParams(roomCodeParamSchema), getGameResultByRoom);

export default router;
