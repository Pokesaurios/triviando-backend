// src/routes/room.routes.ts
import express from "express";
import { createRoom, getRoomState } from "../controllers/room.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/", authMiddleware, createRoom);
router.get("/:code", authMiddleware, getRoomState);

export default router;
