import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.config";

export interface NotificationJobData {
  notificationId: string;
  userId?: string;
  guestEmail?: string;
  title: string;
  content: string;
  emailEnabled: boolean;
  discordEnabled: boolean;
  emailSubject?: string;
  emailContent?: string;
}

export const notificationQueue = new Queue<NotificationJobData>(
  "notification-queue",
  {
    connection: {
      host: redisConfig.host,
      port: redisConfig.port,
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
  `${redisConfig.host}:${redisConfig.port}`,
);
