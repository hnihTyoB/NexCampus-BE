import { envConfig } from "./env.config";

export const redisConfig = {
  host: envConfig.redis.host,
  port: envConfig.redis.port,
};

export default redisConfig;
