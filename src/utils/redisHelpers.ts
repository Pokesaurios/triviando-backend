import redis from "../config/redis";

/**
 * Set a key with NX and PX in a way that works for both ioredis and node-redis v4.
 * Returns the raw response from redis (usually "OK" or null).
 */
export async function setNxPx(key: string, value: string, px: number) {
  try {
    // ioredis supports positional args: set(key, value, 'NX', 'PX', ms)
    const res = await (redis as any).set(key, value, "NX", "PX", px);
    return res;
  } catch (err) {
    try {
      // node-redis v4 uses options object: set(key, value, { NX: true, PX: px })
      const res2 = await (redis as any).set(key, value, { NX: true, PX: px });
      return res2;
    } catch (err2) {
      console.error("[redisHelpers] setNxPx failed:", err2);
      throw err2;
    }
  }
}

export async function delKey(key: string) {
  return redis.del(key);
}
