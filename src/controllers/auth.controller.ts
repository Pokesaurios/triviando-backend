import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import User from "../models/user.model";
import { hashPassword, comparePassword } from "../utils/passwordUtils";
import { generateToken } from "../utils/generateToken";

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await hashPassword(password);
    const newUser = await User.create({ name, email, password: hashed });

    res.status(201).json({
      message: "Registration successful",
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
      token: generateToken(newUser._id.toString()),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.status(200).json({
      message: "Successful login",
      user: { id: user._id, name: user.name, email: user.email },
      token: generateToken(user._id.toString()),
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload: any = req.user as any;
    if (!payload?.id) return res.status(401).json({ message: "User not authenticated" });

    const user = await User.findById(payload.id).select("_id name email").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload: any = req.user as any;
    if (!payload?.id) return res.status(401).json({ message: "User not authenticated" });

    const user = await User.findById(payload.id).select("_id name email").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateToken(user._id.toString());
    return res.status(200).json({ message: "Token refreshed", token, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Stateless JWT: nothing to revoke by default. Respond success for client-side cleanup.
    return res.status(200).json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
};