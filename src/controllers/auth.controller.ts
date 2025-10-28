import { Request, Response, NextFunction } from "express";
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