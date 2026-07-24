import { envConfig } from "./env.config";

export const discordConfig = {
  webhookUrl: envConfig.discord.webhookUrl,
};

export default discordConfig;
