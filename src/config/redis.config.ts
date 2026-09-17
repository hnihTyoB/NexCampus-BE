import IORedis, { RedisOptions } from "ioredis";
import { envConfig } from "./env.config";

/**
 * Phân giải cấu hình RedisOptions tương thích tối đa với IORedis & BullMQ.
 * Ưu tiên chuỗi kết nối REDIS_URL nếu được cung cấp, fallback sang các biến riêng lẻ.
 */
export function getRedisConnectionOptions(): RedisOptions {
  const url = process.env.REDIS_URL || "";
  const baseOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      // Exponential backoff reconnect: 200ms -> 400ms -> ... tối đa 2000ms
      return Math.min(times * 200, 2000);
    },
  };

  if (url) {
    try {
      const parsed = new URL(url);
      baseOptions.host = parsed.hostname || "localhost";
      baseOptions.port = parsed.port
        ? parseInt(parsed.port, 10)
        : parsed.protocol === "rediss:"
          ? 6380
          : 6379;
      if (parsed.password) {
        baseOptions.password = decodeURIComponent(parsed.password);
      }
      if (parsed.username && parsed.username !== "default") {
        baseOptions.username = decodeURIComponent(parsed.username);
      }
      if (parsed.protocol === "rediss:") {
        baseOptions.tls = {};
      }
      return baseOptions;
    } catch {
      // URL không hợp lệ, tiếp tục fallback sang biến môi trường đơn lẻ
    }
  }

  baseOptions.host = envConfig.redis.host || "localhost";
  baseOptions.port = envConfig.redis.port || 6379;
  if (envConfig.redis.password) {
    baseOptions.password = envConfig.redis.password;
  }
  if (envConfig.redis.tls) {
    baseOptions.tls = envConfig.redis.tls;
  }

  return baseOptions;
}

/**
 * Khởi tạo một Redis client mới với cấu hình an toàn
 */
export function createRedisClient(
  customOptions?: Partial<RedisOptions>,
): IORedis {
  const baseOptions = getRedisConnectionOptions();
  return new IORedis({
    ...baseOptions,
    ...customOptions,
  });
}

export const redisConfig = {
  get options(): RedisOptions {
    return getRedisConnectionOptions();
  },
  createClient: createRedisClient,
  enabled: envConfig.redis.enabled,
};

export default redisConfig;
