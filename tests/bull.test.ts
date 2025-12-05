import { createQueue, bullConnection, Worker } from "../src/queues/bullmq";

// ✅ Mock de bullmq (sin QueueScheduler)
jest.mock("bullmq", () => {
  return {
    Queue: jest.fn(),
    Worker: jest.fn(),
  };
});

// ✅ Importamos el mock real que Jest creó
import { Queue } from "bullmq";

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

  // ✅ export de Worker
  it("should export Worker from bullmq", () => {
    expect(Worker).toBeDefined();
    expect(typeof Worker).toBe("function");
  });
});