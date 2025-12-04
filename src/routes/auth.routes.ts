import express from "express";
import { register, login, me, refreshToken, logout } from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { registerSchema, loginSchema } from "../schemas/auth";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", authMiddleware, me);
router.post("/refresh", authMiddleware, refreshToken);
router.post("/logout", authMiddleware, logout);

export default router;