import express from "express";
import { generateTrivia } from "../controllers/trivia.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/generate", authMiddleware, generateTrivia);

export default router;