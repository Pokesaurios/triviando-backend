import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import express, { json } from "express";

import { Trivia } from "../src/models/trivia.model";
import { generateTrivia } from "../src/controllers/trivia.controller";
import * as aiService from "../src/services/aiGenerator.service";

jest.setTimeout(30000); // por si hay delays simulados

// --- Mock del servicio AI ---
let generateQuestionsMock: jest.SpyInstance;
beforeAll(() => {
  generateQuestionsMock = jest.spyOn(aiService, "generateQuestions").mockImplementation(async (topic, quantity) => {
    return Array.from({ length: quantity }, (_, i) => ({
      question: `${topic} Question ${i + 1}`,
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      difficulty: "easy",
    }));
  });
});

// --- Setup de Express para test ---
const app = express();
app.use(json());
app.post("/trivia", (req, res) => generateTrivia(req as any, res));

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
  // Limpiar colecciones entre tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ------------------- TESTS -------------------

describe("Integration tests - generateTrivia endpoint", () => {

  it("should return 400 if topic is missing", async () => {
    const res = await request(app)
      .post("/trivia")
      .send({ topic: "", quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Debes enviar un tema válido." });
  });

  it("should return 400 if quantity is invalid", async () => {
    const res = await request(app)
      .post("/trivia")
      .send({ topic: "Math", quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: "Cantidad de preguntas inválida (rango 5 a 20).",
    });
  });

  it("should generate trivia successfully and save in DB", async () => {
    const res = await request(app)
      .post("/trivia")
      .send({ topic: "Science", quantity: 7, user: { _id: "user123" } });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Trivia generada exitosamente 🎉");
    expect(res.body.totalQuestions).toBe(7);
    expect(res.body.preview.length).toBe(3);

    const triviaInDb = await Trivia.findById(res.body.triviaId).lean();
    expect(triviaInDb).toBeTruthy();
    expect(triviaInDb?.topic).toBe("Science");
    expect(triviaInDb?.questions.length).toBe(7);
  });

  it("should handle multiple calls with different topics", async () => {
    await request(app).post("/trivia").send({ topic: "History", quantity: 5 });
    await request(app).post("/trivia").send({ topic: "Geography", quantity: 6 });

    const allTrivia = await Trivia.find().lean();
    expect(allTrivia.length).toBe(2);
    expect(allTrivia.map(t => t.topic)).toEqual(expect.arrayContaining(["History", "Geography"]));
  });

  // ------------------- Tests para cobertura de branches -------------------

  it("should retry generateQuestions until success", async () => {
    const error = new Error("AI service failed");
    const mockQuestions = [{ question: "Q", options: ["A"], correctAnswer: "A", difficulty: "easy" }];

    // Los dos primeros intentos fallan, luego succeed
    generateQuestionsMock
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockQuestions);

    const res = await request(app)
        .post("/trivia")
        .send({ topic: "RetryTest", quantity: 5, user: { _id: "userRetry" } }); // quantity >= 5

    expect(res.status).toBe(201);
    expect(res.body.totalQuestions).toBe(1); // ajusta según tu mock si genera 1 pregunta o más
    });

    it("should return 500 if all retries fail", async () => {
    const error = new Error("AI failed completely");

    generateQuestionsMock.mockRejectedValue(error);

    const res = await request(app)
        .post("/trivia")
        .send({ topic: "FailTest", quantity: 5, user: { _id: "userFail" } });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI failed completely");
    });

    it("should return 500 if saving trivia fails", async () => {
    const mockQuestions = [{ question: "Q", options: ["A"], correctAnswer: "A", difficulty: "easy" }];

    generateQuestionsMock.mockResolvedValue(mockQuestions);

    const originalSave = Trivia.prototype.save;
    Trivia.prototype.save = jest.fn().mockRejectedValue(new Error("DB save failed"));

    const res = await request(app)
        .post("/trivia")
        .send({ topic: "DBFailTest", quantity: 5, user: { _id: "userDBFail" } });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("DB save failed");

    Trivia.prototype.save = originalSave;
    });
});