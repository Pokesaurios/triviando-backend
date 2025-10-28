import { Router } from "express";
import { getGameResults, getGameResultByRoom } from "../controllers/gameResult.controller";

const router = Router();

router.get("/", getGameResults);
router.get("/:code", getGameResultByRoom);

export default router;
