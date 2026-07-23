import { envConfig } from "./env.config";

export const aiConfig = {
  provider: envConfig.aiProvider,
  gemini: {
    apiKeys: envConfig.gemini.apiKeys,
  },
};

export default aiConfig;
