import Redis from "ioredis";
import { EventEmitter } from "events";
import logger from "../utils/logger";

const redisUrl = process.env.REDIS_URL || "redis://default:password@host:port";

let client: any;
if (process.env.NODE_ENV === 'test') {
  // In tests return a lightweight stub that won't open network handles or emit async logs.
  const emitter = new EventEmitter();
  const handler = {
    get: (_target: any, prop: string) => {
      if (prop === 'on' || prop === 'emit' || prop === 'removeListener') {
        const fn = emitter[prop as keyof EventEmitter] as (...args: any[]) => any;
        return fn.bind(emitter);
      }
      // return a no-op async function for any redis command used in tests
      return async (..._args: any[]) => null;
    },
  };
  client = new Proxy(emitter as any, handler);
} else {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  client.on("connect", () => logger.info("Connected to Redis Cloud"));
  client.on("error", (err: any) => logger.error({ err: err?.message || err }, "Redis error"));
}

export default client;