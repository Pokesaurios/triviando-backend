import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { generateTrivia } from "../src/controllers/trivia.controller";
import { Trivia } from "../src/models/trivia.model";
import { generateQuestions } from "../src/services/aiGenerator.service";
import { authMiddleware } from "../src/middleware/auth.middleware";

jest.mock("../src/services/aiGenerator.service");
jest.mock("../src/middleware/auth.middleware");

const app = express();
app.use(express.json());
app.post("/api/trivia/generate", authMiddleware, generateTrivia);

describe("POST /api/trivia/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authMiddleware as jest.Mock).mockImplementation((req, _res, next) => {
      (req as any).user = { _id: new mongoose.Types.ObjectId() };
      next();
    });
  });

  it("❌ debería devolver 400 si falta el tema", async () => {
    const res = await request(app).post("/api/trivia/generate").send({ topic: "", quantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tema válido/i);
  });

  it("✅ debería generar trivia correctamente", async () => {
    const mockQuestions = [
      {
        question: "¿Quién fue el libertador de Colombia?",
        options: ["Simón Bolívar", "Santander", "Nariño", "Sucre"],
        correctAnswer: "Simón Bolívar",
        difficulty: "easy",
      },
    ];

    // Mock de IA
    (generateQuestions as jest.Mock).mockResolvedValue(mockQuestions);

    // Mock de persistencia
    jest.spyOn(Trivia.prototype, "save").mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      topic: "Historia",
      questions: mockQuestions,
      creator: new mongoose.Types.ObjectId(),
    } as any);

    const res = await request(app)
      .post("/api/trivia/generate")
      .send({ topic: "Historia de Colombia", quantity: 5 }); // ✅ rango válido

    console.log("💡 Response:", res.status, res.body);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("triviaId");
  });

  it("🔥 debería manejar errores del servicio IA", async () => {
    (generateQuestions as jest.Mock).mockRejectedValue(new Error("IA no responde"));

    const res = await request(app)
      .post("/api/trivia/generate")
      .send({ topic: "Ciencia", quantity: 5 });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/error al generar/i);
  });
});