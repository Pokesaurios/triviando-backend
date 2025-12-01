import { Room as RoomModelType } from "../models/room.model";

export function buildRoomCacheData(room: any) {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map((p: any) => ({ userId: p.userId, name: p.name })),
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
  };
}

export function buildSanitizedRoom(room: any) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    players: room.players.map((p: any) => ({ userId: p.userId?.toString?.() || p.userId, name: p.name })),
    hostId: room.hostId,
  };
}
