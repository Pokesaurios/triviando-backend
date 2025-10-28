import { Room } from "../models/room.model";
import mongoose from "mongoose";

interface JoinRoomResult {
  ok: boolean;
  message: string;
  room?: any;
}

export async function joinRoomAtomically(roomCode: string, userId: string, userName: string): Promise<JoinRoomResult> {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const updatedRoom = await Room.findOneAndUpdate(
    {
      code: roomCode,
      status: "waiting",
      "players.userId": { $ne: userObjectId },
      $expr: { $lt: [{ $size: "$players" }, "$maxPlayers"] },
    },
    {
      $push: {
        players: {
          userId: userObjectId,
          name: userName,
          joinedAt: new Date(),
        },
      },
    },
    { new: true }
  ).lean();

  if (!updatedRoom) {
    const roomCheck = await Room.findOne({ code: roomCode }).lean();
    if (!roomCheck) return { ok: false, message: "Sala no encontrada" };
    if (roomCheck.players.some((p: any) => p.userId.toString() === userId))
      return { ok: true, message: "Ya estás en la sala", room: roomCheck };
    if (roomCheck.players.length >= roomCheck.maxPlayers) return { ok: false, message: "Sala llena" };
    return { ok: false, message: "No se pudo unir a la sala" };
  }

  return { ok: true, message: "Unido correctamente", room: updatedRoom };
}