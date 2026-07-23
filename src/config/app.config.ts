import { envConfig } from "./env.config";

export const appConfig = {
  port: envConfig.port,
  nodeEnv: envConfig.nodeEnv,
  baseUrl: envConfig.app.baseUrl,
  trustProxy: envConfig.app.trustProxy,
};

export default appConfig;
