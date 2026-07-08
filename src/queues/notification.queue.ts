import { Queue } from "bullmq";
import { envConfig } from "../config/env.config";

export interface NotificationJobData {
  notificationId: string;
  userId: string;
  title: string;
  content: string;
  emailEnabled: boolean;
  discordEnabled: boolean;
}

export const notificationQueue = new Queue<NotificationJobData>(
  "notification-queue",
  {
    connection: {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000, // Start retry after 5s, then 10s, then 20s
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  },
);

console.log(
  "[NotificationQueue] Queue initialized — connecting to Redis at",
  `${envConfig.redis.host}:${envConfig.redis.port}`,
);
