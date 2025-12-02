// src/lib/__tests__/bull.test.ts
import { createQueue, createScheduler, bullConnection, Worker } from "../src/queues/bullmq";

// ✅ Mock de bullmq
jest.mock("bullmq", () => {
  return {
    Queue: jest.fn(),
    Worker: jest.fn(),
    QueueScheduler: jest.fn(),
  };
});

// ✅ Importamos el mock real que Jest creó
import { Queue, QueueScheduler } from "bullmq";

describe("bull helpers", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, REDIS_URL: "redis://localhost:6379" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // ✅ createQueue
  it("should create a Queue with correct name and connection", () => {
    const name = "test-queue";

    createQueue(name);

    expect(Queue).toHaveBeenCalledTimes(1);
    expect(Queue).toHaveBeenCalledWith(name, bullConnection);
  });

  // ✅ createScheduler
  it("should create a QueueScheduler with correct name and connection", () => {
    const name = "test-scheduler";

    createScheduler(name);

    expect(QueueScheduler).toHaveBeenCalledTimes(1);
    expect(QueueScheduler).toHaveBeenCalledWith(name, bullConnection);
  });

  // ✅ export de Worker
  it("should export Worker from bullmq", () => {
    expect(Worker).toBeDefined();
    expect(typeof Worker).toBe("function");
  });
});
