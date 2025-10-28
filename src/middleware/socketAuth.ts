import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

export async function socketAuthMiddleware(socket: Socket, next: (err?: any) => void) {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers["authorization"] as string)?.replace("Bearer ", "");

    if (!token) return next(new Error("Not authenticated"));

    const payload: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await User.findById(payload.id).select("_id name email").lean();

    if (!user) return next(new Error("User not found"));

    socket.data.user = { id: user._id.toString(), name: user.name };
    next();
  } catch {
    next(new Error("Authentication error"));
  }
}