import { envConfig } from "./env.config";

export const cronConfig = {
  timezone: process.env.CRON_TZ || "Asia/Ho_Chi_Minh",
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

