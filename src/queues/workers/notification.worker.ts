import { Worker, Job, WorkerOptions } from "bullmq";
import { getRedisConnectionOptions } from "../../config/redis.config";
import { envConfig } from "../../config/env.config";
import { NotificationJobData, QUEUE_NAMES } from "../index";
import { notificationRepository } from "../../modules/notification/notification.repository";
import { sseManagerService } from "../../common/services/sse-manager.service";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

let notificationWorkerInstance: Worker<NotificationJobData> | undefined;

export async function processNotificationJob(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { type, userId, title, content, data } = job.data;
  console.log(
    `[NotificationWorker] Processing notification job #${job.id} for user ${userId}`,
  );

  try {
    // 1. Lưu thông báo cá nhân vào Database nếu userId tồn tại
    if (userId) {
      const created = await notificationRepository.createSingleNotification({
        userId,
        type: type || "INFO",
        title,
        content,
        metadata: data,
      });

      // 2. Bắn sự kiện realtime qua SSE cho người dùng đang kết nối
      sseManagerService.sendToUser(userId, {
        type: "NOTIFICATION",
        data: {
          id: created.id,
          title,
          content,
          createdAt: created.createdAt,
        },
      });
    }

    console.log(`[NotificationWorker] ✅ Job #${job.id} completed successfully`);
  } catch (error: any) {
    console.error(
      `[NotificationWorker] ❌ Job #${job.id} failed:`,
      error.message,
    );
    throw error;
  }
}

export function startNotificationWorker():
  | Worker<NotificationJobData>
  | undefined {
  if (isTestEnv || !envConfig.redis.enabled) {
    return undefined;
  }

  if (notificationWorkerInstance) {
    return notificationWorkerInstance;
  }

  const workerOptions: WorkerOptions = {
    connection: getRedisConnectionOptions() as any,
    concurrency: 5,
  };

  notificationWorkerInstance = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    processNotificationJob,
    workerOptions,
  );

  notificationWorkerInstance.on("completed", (job) => {
    console.log(`[NotificationWorker] Job #${job.id} completed.`);
  });

  notificationWorkerInstance.on("failed", (job, err) => {
    console.warn(`[NotificationWorker] Job #${job?.id} failed: ${err.message}`);
  });

  return notificationWorkerInstance;
}

export async function stopNotificationWorker(): Promise<void> {
  if (notificationWorkerInstance) {
    await notificationWorkerInstance.close().catch(() => {});
    notificationWorkerInstance = undefined;
    console.log("[NotificationWorker] Worker stopped cleanly.");
  }
}
