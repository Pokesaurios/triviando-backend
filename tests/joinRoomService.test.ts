import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Room } from "../src/models/room.model";
import { joinRoomAtomically } from "../src/services/joinRoom.service";

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Room.deleteMany({});
});

// ──────────────── TESTS ────────────────
describe("joinRoomAtomically", () => {
  it("should join room successfully", async () => {
    const hostId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    await Room.create({
      code: "ROOM1",
      hostId,
      triviaId: new mongoose.Types.ObjectId(),
      maxPlayers: 4,
      players: [{ userId: hostId, name: "Host" }],
      status: "waiting",
    });

    const result = await joinRoomAtomically("ROOM1", userId.toHexString(), "Player1");

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Unido correctamente");
    expect(result.room?.players).toHaveLength(2);
    expect(result.room?.players[1].name).toBe("Player1");
  });

  it("should return 'Ya estás en la sala' if user already joined", async () => {
    const hostId = new mongoose.Types.ObjectId();

    await Room.create({
      code: "ROOM2",
      hostId,
      triviaId: new mongoose.Types.ObjectId(),
      maxPlayers: 4,
      players: [{ userId: hostId, name: "Host" }],
      status: "waiting",
    });

    // Join once
    await joinRoomAtomically("ROOM2", hostId.toHexString(), "Host");
    // Try joining again
    const result = await joinRoomAtomically("ROOM2", hostId.toHexString(), "Host");

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Ya estás en la sala");
  });

  it("should return 'Sala llena' if max players reached", async () => {
    const hostId = new mongoose.Types.ObjectId();
    const player2 = new mongoose.Types.ObjectId();
    const player3 = new mongoose.Types.ObjectId();

    await Room.create({
      code: "ROOM3",
      hostId,
      triviaId: new mongoose.Types.ObjectId(),
      maxPlayers: 2,
      players: [
        { userId: hostId, name: "Host" },
        { userId: player2, name: "Player2" },
      ],
      status: "waiting",
    });

    const result = await joinRoomAtomically("ROOM3", player3.toHexString(), "Player3");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Sala llena");
  });

  it("should return 'Sala no encontrada' if room doesn't exist", async () => {
    const result = await joinRoomAtomically("NOEXIST", new mongoose.Types.ObjectId().toHexString(), "Ghost");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Sala no encontrada");
  });

  it("should return 'No se pudo unir a la sala' for non-waiting rooms", async () => {
    const hostId = new mongoose.Types.ObjectId();
    const playerId = new mongoose.Types.ObjectId();

    await Room.create({
      code: "ROOM4",
      hostId,
      triviaId: new mongoose.Types.ObjectId(),
      maxPlayers: 4,
      players: [{ userId: hostId, name: "Host" }],
      status: "in-game", // 🚫 not waiting
    });

    const result = await joinRoomAtomically("ROOM4", playerId.toHexString(), "LatePlayer");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("No se pudo unir a la sala");
  });

  // ──────────────── 🔥 TEST DE CONCURRENCIA ────────────────
  it("should allow only one user to join concurrently when one slot is left", async () => {
    const hostId = new mongoose.Types.ObjectId();

    await Room.create({
      code: "ROOM5",
      hostId,
      triviaId: new mongoose.Types.ObjectId(),
      maxPlayers: 2,
      players: [{ userId: hostId, name: "Host" }],
      status: "waiting",
    });

    const userA = new mongoose.Types.ObjectId().toHexString();
    const userB = new mongoose.Types.ObjectId().toHexString();

    // Ejecutamos ambas promesas simultáneamente
    const [resultA, resultB] = await Promise.allSettled([
      joinRoomAtomically("ROOM5", userA, "UserA"),
      joinRoomAtomically("ROOM5", userB, "UserB"),
    ]);

    // Al menos uno debe unirse exitosamente
    const successes = [resultA, resultB].filter(
      (r) => r.status === "fulfilled" && r.value.ok
    );

    const failures = [resultA, resultB].filter(
      (r) => r.status === "fulfilled" && !r.value.ok
    );

    // Validamos que solo uno logra unirse
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // La sala debe tener exactamente 2 jugadores
    const finalRoom = await Room.findOne({ code: "ROOM5" }).lean();
    expect(finalRoom?.players).toHaveLength(2);
  });
});