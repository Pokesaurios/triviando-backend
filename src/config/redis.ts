import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://default:password@host:port";

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => console.log("✅ Connected to Redis Cloud"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;