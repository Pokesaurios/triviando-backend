import express from "express";
import { register, login, me, refreshToken, logout } from "../controllers/auth.controller";
import { validateBody, validateQuery } from "../middleware/validate";
import { registerSchema, loginSchema } from "../schemas/auth";
import { emptyObjectSchema } from "../schemas/common";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", authMiddleware, validateQuery(emptyObjectSchema), me);
router.post("/refresh", authMiddleware, validateBody(emptyObjectSchema), refreshToken);
router.post("/logout", authMiddleware, validateBody(emptyObjectSchema), logout);

export default router;