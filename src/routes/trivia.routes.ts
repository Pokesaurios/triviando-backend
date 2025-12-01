import express from "express";
import { generateTrivia } from "../controllers/trivia.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { generateTriviaSchema } from "../schemas/trivia";

const router = express.Router();

router.post("/generate", authMiddleware, validateBody(generateTriviaSchema), generateTrivia);

export default router;