import { Queue, QueueOptions, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { getRedisConnectionOptions } from "../config/redis.config";
import { envConfig } from "../config/env.config";
import { EmailTemplateType } from "./templates/email-templates";

export const QUEUE_NAMES = {
  EMAIL: "email-queue",
  NOTIFICATION: "notification-queue",
  CLEANUP: "cleanup-queue",
} as const;

export interface EmailJobData {
  type: EmailTemplateType;
  to: string;
  subject?: string;
  data: Record<string, unknown>;
}

export interface NotificationJobData {
  type: string;
  userId: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

export interface CleanupJobData {
  type: "STORAGE_ORPHANS" | "EXPIRED_DATA" | "FULL_CLEANUP";
  prefixes?: string[];
  retentionHours?: number;
}

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000, // 5s -> 10s -> 20s
  },
  removeOnComplete: true,
  removeOnFail: 50,
};

let sharedRedisConnection: IORedis | undefined;
let isRedisAvailable = false;

function getSharedRedis(): IORedis | undefined {
  if (isTestEnv || !envConfig.redis.enabled) {
    return undefined;
  }

  if (!sharedRedisConnection) {
    try {
      const options = getRedisConnectionOptions();
      sharedRedisConnection = new IORedis({
        ...options,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });

      sharedRedisConnection.on("connect", () => {
        isRedisAvailable = true;
      });

      sharedRedisConnection.on("error", (err) => {
        isRedisAvailable = false;
        if (envConfig.nodeEnv !== "production") {
          console.warn("[BullMQ] Redis connection error:", err.message);
        }
      });

      sharedRedisConnection.connect().catch(() => {
        isRedisAvailable = false;
      });
    } catch {
      isRedisAvailable = false;
    }
  }

  return sharedRedisConnection;
}

function createQueue<T>(name: string): Queue<T> | undefined {
  const connection = getSharedRedis();
  if (!connection) {
    return undefined;
  }

  const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions,
  };

  const queue = new Queue<T>(name, queueOptions);
  queue.on("error", (err) => {
    if (envConfig.nodeEnv !== "production") {
      console.warn(`[BullMQ:${name}] Queue connection error:`, err.message);
    }
  });

  return queue;
}

// Khởi tạo các hàng đợi cốt lõi
export const emailQueue = createQueue<EmailJobData>(QUEUE_NAMES.EMAIL);
export const notificationQueue = createQueue<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATION,
);
export const cleanupQueue = createQueue<CleanupJobData>(QUEUE_NAMES.CLEANUP);

/**
 * Đẩy job gửi email vào emailQueue
 */
export async function dispatchEmailJob(
  data: EmailJobData,
  options?: JobsOptions,
): Promise<{ id?: string; dispatched: boolean }> {
  try {
    if (emailQueue && isRedisAvailable) {
      const job = await emailQueue.add(data.type, data, {
        ...defaultJobOptions,
        ...options,
      });
      return { id: job.id, dispatched: true };
    }
    // Fallback log khi Redis offline hoặc đang trong test
    console.log(`[EmailQueue:Fallback] Enqueued job ${data.type} to ${data.to}`);
    return { id: `mock-${Date.now()}`, dispatched: false };
  } catch (err: any) {
    console.error("[EmailQueue] Failed to dispatch email job:", err.message);
    return { dispatched: false };
  }
}

/**
 * Đẩy job thông báo đẩy vào notificationQueue
 */
export async function dispatchNotificationJob(
  data: NotificationJobData,
  options?: JobsOptions,
): Promise<{ id?: string; dispatched: boolean }> {
  try {
    if (notificationQueue && isRedisAvailable) {
      const job = await notificationQueue.add(data.type, data, {
        ...defaultJobOptions,
        ...options,
      });
      return { id: job.id, dispatched: true };
    }
    return { id: `mock-${Date.now()}`, dispatched: false };
  } catch (err: any) {
    console.error(
      "[NotificationQueue] Failed to dispatch notification job:",
      err.message,
    );
    return { dispatched: false };
  }
}

/**
 * Đẩy job dọn dẹp vào cleanupQueue
 */
export async function dispatchCleanupJob(
  data: CleanupJobData,
  options?: JobsOptions,
): Promise<{ id?: string; dispatched: boolean }> {
  try {
    if (cleanupQueue && isRedisAvailable) {
      const job = await cleanupQueue.add(data.type, data, {
        ...defaultJobOptions,
        ...options,
      });
      return { id: job.id, dispatched: true };
    }
    return { id: `mock-${Date.now()}`, dispatched: false };
  } catch (err: any) {
    console.error("[CleanupQueue] Failed to dispatch cleanup job:", err.message);
    return { dispatched: false };
  }
}

/**
 * Lên lịch dọn dẹp định kỳ lặp lại (Hàng ngày lúc 03:00 sáng Asia/Ho_Chi_Minh)
 */
export async function scheduleCleanupRepeatableJob(
  cronPattern = "0 3 * * *",
): Promise<void> {
  if (!cleanupQueue || !isRedisAvailable) return;

  try {
    const jobSchedulerName = "daily-storage-database-cleanup";
    await cleanupQueue.upsertJobScheduler(
      jobSchedulerName,
      { pattern: cronPattern, tz: "Asia/Ho_Chi_Minh" },
      {
        name: "FULL_CLEANUP",
        data: {
          type: "FULL_CLEANUP",
          retentionHours: 2,
        },
      },
    );
    console.log(
      `[CleanupQueue] Registered repeatable cleanup job (${cronPattern} Asia/Ho_Chi_Minh)`,
    );
  } catch (err: any) {
    console.warn(
      "[CleanupQueue] Failed to schedule repeatable cleanup job:",
      err.message,
    );
  }
}

/**
 * Đóng tất cả hàng đợi và ngắt kết nối Redis an toàn
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (emailQueue) {
    closePromises.push(emailQueue.close().catch(() => {}));
  }
  if (notificationQueue) {
    closePromises.push(notificationQueue.close().catch(() => {}));
  }
  if (cleanupQueue) {
    closePromises.push(cleanupQueue.close().catch(() => {}));
  }

  await Promise.allSettled(closePromises);

  if (sharedRedisConnection) {
    sharedRedisConnection.disconnect();
    sharedRedisConnection = undefined;
  }
  isRedisAvailable = false;
  console.log("[Queues] All BullMQ queues and connections closed cleanly.");
}
