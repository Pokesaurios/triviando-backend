import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { register, login } from "../src/controllers/auth.controller";
import User from "../src/models/user.model";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

jest.mock("../src/models/user.model");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const app = express();
app.use(express.json());
app.post("/api/v1/auth/register", register);
app.post("/api/v1/auth/login", login);

describe("🧩 Auth Endpoints (mockeados)", () => {
  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test",
    email: "test@example.com",
    password: "hashedPassword",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("✅ should register a new user", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");
    (User.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Test", email: "test@example.com", password: "Test123!" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("test@example.com");
  });

  it("🚫 should prevent duplicate email registration", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Test", email: "test@example.com", password: "Test123!" });

    expect(res.status).toBe(400);
    // ✅ Ajuste al texto real de tu backend
    expect(res.body.message).toMatch(/email already registered/i);
  });

  it("🔐 should login successfully", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("fake-jwt-token");

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "Test123!" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token", "fake-jwt-token");
  });

  it("❌ should fail login with wrong password", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "wrongPass" });

    expect(res.status).toBe(400);
    // ✅ Ajuste al texto real de tu backend
    expect(res.body.message).toMatch(/invalid credentials/i);
  });
});