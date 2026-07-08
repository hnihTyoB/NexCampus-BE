import { Queue } from "bullmq";
import { envConfig } from "../config/env.config";

export type ReminderJobData = Record<string, never>;

export const reminderQueue = new Queue<ReminderJobData>(
  "reminder-queue",
  {
    connection: {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10000, // 10s -> 20s -> 40s
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  },
);

/**
 * Schedule repeatable job for reminders based on cron expression in env config.
 */
export async function scheduleReminderJob() {
  const cronExpression = envConfig.reminders.cronExpression;

  // Clear existing repeatable jobs to avoid duplication
  const existingJobs = await reminderQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await reminderQueue.removeRepeatableByKey(job.key);
  }

  await reminderQueue.add(
    "send-reminders",
    {},
    {
      repeat: { pattern: cronExpression },
    },
  );

  console.log(
    `[ReminderQueue] Scheduled reminder job — cron: "${cronExpression}"`
  );
}
