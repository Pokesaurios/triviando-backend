import { Router } from "express";
import { createRoom, joinRoom, getRoomState } from "../controllers/room.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/:code", authMiddleware, getRoomState);

export default router;