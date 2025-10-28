import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../src/models/user.model";
import { socketAuthMiddleware } from "../src/middleware/socketAuth";

jest.mock("jsonwebtoken");
jest.mock("../src/models/user.model");

describe("socketAuthMiddleware", () => {
  const mockUser = { _id: "123", name: "Test User", email: "test@test.com" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("✅ autentica correctamente con token válido", async () => {
    const mockSocket = { handshake: { auth: { token: "abc" } }, data: {} } as unknown as Socket;
    (jwt.verify as jest.Mock).mockReturnValue({ id: "123" });
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockUser),
    });

    const next = jest.fn();
    await socketAuthMiddleware(mockSocket, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.data.user.name).toBe("Test User");
  });

  it("❌ falla si token ausente", async () => {
    const mockSocket = { handshake: { auth: {} }, data: {} } as unknown as Socket;
    const next = jest.fn();
    await socketAuthMiddleware(mockSocket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("❌ falla si user no existe", async () => {
    const mockSocket = { handshake: { auth: { token: "abc" } }, data: {} } as unknown as Socket;
    (jwt.verify as jest.Mock).mockReturnValue({ id: "123" });
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });
    const next = jest.fn();
    await socketAuthMiddleware(mockSocket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});