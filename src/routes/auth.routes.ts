import express from "express";
import { register, login, me, logout, refresh } from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "../schemas/auth";

const router = express.Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", authMiddleware, me);
router.post("/logout", logout);
router.post("/refresh", refresh);

export default router;