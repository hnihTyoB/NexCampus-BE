import { envConfig } from "./env.config";

export const cronConfig = {
  storageCleanup: {
    retentionDays: envConfig.storageCleanup.retentionDays,
    cronExpression: envConfig.storageCleanup.cronExpression,
  },
  reminders: {
    cronExpression: envConfig.reminders.cronExpression,
    thresholdHours: envConfig.reminders.thresholdHours,
  },
};

export default cronConfig;
