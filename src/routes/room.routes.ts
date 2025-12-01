import { Router } from "express";
import { createRoom, joinRoom, getRoomState } from "../controllers/room.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateBody, validateParams } from "../middleware/validate";
import { joinRoomSchema, createRoomSchema, roomCodeParamSchema } from "../schemas/room";

const router = Router();

router.post("/create", authMiddleware, validateBody(createRoomSchema), createRoom);
router.post("/join", authMiddleware, validateBody(joinRoomSchema), joinRoom);
router.get("/:code", authMiddleware, validateParams(roomCodeParamSchema), getRoomState);

export default router;