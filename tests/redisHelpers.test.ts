import redis from "../src/config/redis";
import { setNxPx } from "../src/utils/redisHelpers";

jest.mock("../src/config/redis", () => ({
  set: jest.fn(),
}));

describe("redisHelpers.setNxPx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses positional args (ioredis) when available and returns OK", async () => {
    (redis.set as jest.Mock).mockResolvedValueOnce("OK");

    const res = await setNxPx("key1", "val1", 1234);

    expect(res).toBe("OK");
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect((redis.set as jest.Mock).mock.calls[0]).toEqual(["key1", "val1", "NX", "PX", 1234]);
  });

  it("falls back to object options when positional form throws", async () => {
    // First call throws (positional), second call resolves (object form)
    (redis.set as jest.Mock)
      .mockRejectedValueOnce(new Error("positional error"))
      .mockResolvedValueOnce("OK");

    const res = await setNxPx("k2", "v2", 5000);

    expect(res).toBe("OK");
    expect(redis.set).toHaveBeenCalledTimes(2);
    // Second call should have been with options object
    expect((redis.set as jest.Mock).mock.calls[1]).toEqual(["k2", "v2", { NX: true, PX: 5000 }]);
  });

  it("throws when both positional and options forms fail", async () => {
    (redis.set as jest.Mock).mockRejectedValue(new Error("both fail"));

    await expect(setNxPx("k3", "v3", 10)).rejects.toThrow("both fail");
    expect(redis.set).toHaveBeenCalled();
  });
});
