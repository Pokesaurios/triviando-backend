import { addChatMessage, getChatHistory } from "../src/utils/redisChat";
import redis from "../src/config/redis";

jest.mock("../src/config/redis", () => ({
  rpush: jest.fn(),
  ltrim: jest.fn(),
  lrange: jest.fn(),
}));

describe("Chat module full flow", () => {
  const roomCode = "ROOM123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should keep only the last 20 messages in chat history", async () => {
    const totalMessages = 25;
    const messages = [];

    // Simular agregar 25 mensajes
    for (let i = 1; i <= totalMessages; i++) {
      const msg = { user: `User${i}`, text: `Message ${i}` };
      messages.push(msg);
      await addChatMessage(roomCode, msg);

      // Cada vez que agregamos, verificamos que rpush y ltrim fueron llamados
      expect(redis.rpush).toHaveBeenLastCalledWith(
        `room:${roomCode}:chat`,
        JSON.stringify(msg)
      );
      expect(redis.ltrim).toHaveBeenLastCalledWith(
        `room:${roomCode}:chat`,
        -20,
        -1
      );
    }

    // Simular Redis devolviendo solo los últimos 20 mensajes
    const last20Messages = messages.slice(-20).map((m) => JSON.stringify(m));
    (redis.lrange as jest.Mock).mockResolvedValue(last20Messages);

    const history = await getChatHistory(roomCode);

    expect(history.length).toBe(20);
    expect(history[0].text).toBe("Message 6"); // el primero de los últimos 20
    expect(history[19].text).toBe("Message 25"); // el último agregado
  });

  it("should return empty array if no messages exist", async () => {
    (redis.lrange as jest.Mock).mockResolvedValue([]);
    const history = await getChatHistory(roomCode);
    expect(history).toEqual([]);
  });
});