import { Queue } from "bullmq";
import { envConfig } from "../config/env.config";

// Job data rong - day la scheduled job, khong can truyen data
export type StorageCleanupJobData = Record<string, never>;

export const storageCleanupQueue = new Queue<StorageCleanupJobData>(
  "storage-cleanup-queue",
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
 * Dang ky repeatable job (chay theo lich cron tu env).
 * Goi mot lan khi khoi dong server.
 */
export async function scheduleStorageCleanupJob() {
  const { cronExpression, retentionDays } = envConfig.storageCleanup;

  // Xoa job cu truoc de tranh trung lap khi restart
  const existingJobs = await storageCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await storageCleanupQueue.removeRepeatableByKey(job.key);
  }

  await storageCleanupQueue.add(
    "cleanup",
    {},
    {
      repeat: { pattern: cronExpression },
    },
  );

  console.log(
    `[StorageCleanupQueue] Scheduled cleanup job � cron: "${cronExpression}", retention: ${retentionDays} days`,
  );
}
