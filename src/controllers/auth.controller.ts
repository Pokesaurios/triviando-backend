import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import { hashPassword, comparePassword } from "../utils/passwordUtils";
import { generateToken } from "../utils/generateToken";
import { generateRefreshToken, hashToken } from "../utils/refreshTokenUtils";

// small helper to read a cookie by name without adding cookie-parser dependency
function readCookie(req: Request, name: string): string | null {
  const header = req.headers?.cookie as string | undefined;
  if (!header) return null;
  const pairs = header.split(';').map(p => p.trim());
  for (const p of pairs) {
    const [k, ...v] = p.split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await hashPassword(password);
    const newUser = await User.create({ name, email, password: hashed });

    const refresh = generateRefreshToken();
    const hashedRefresh = hashToken(refresh);
    await User.findByIdAndUpdate(newUser._id, { $push: { refreshTokens: hashedRefresh } });

    res.cookie('refreshToken', refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

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

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const refresh = generateRefreshToken();
    const hashedRefresh = hashToken(refresh);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(hashedRefresh);
    await user.save();

    res.cookie('refreshToken', refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Successful login",
      user: { id: user._id, name: user.name, email: user.email },
      token: generateToken(user._id.toString()),
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const payload: any = (req as any).user;
    if (!payload?.id) return res.status(401).json({ message: 'Not authenticated' });

    const user = await User.findById(payload.id).select('_id name email').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'OK', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const cookie = readCookie(req, 'refreshToken');
    if (cookie) {
      const hashed = hashToken(cookie);
      await User.updateOne({ refreshTokens: hashed }, { $pull: { refreshTokens: hashed } });
    }
    res.clearCookie('refreshToken', { path: '/' });
    return res.status(200).json({ message: 'Logged out' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error during logout', error: err.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const cookie = readCookie(req, 'refreshToken');
    if (!cookie) return res.status(401).json({ message: 'No refresh token' });

    const hashed = hashToken(cookie);
    const user = await User.findOne({ refreshTokens: hashed }).select('_id name email refreshTokens');
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    user.refreshTokens = (user.refreshTokens || []).filter((t: string) => t !== hashed);
    const newRefresh = generateRefreshToken();
    const newHashed = hashToken(newRefresh);
    user.refreshTokens.push(newHashed);
    await user.save();

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const accessToken = generateToken(user._id.toString());
    return res.status(200).json({ message: 'Token refreshed', token: accessToken, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error refreshing token', error: err.message });
  }
};