import { Worker, Job } from "bullmq";
import { redisConfig } from "../config/redis.config";
import { supabaseConfig } from "../config/supabase.config";
import { cronConfig } from "../config/cron.config";
import { TaskAttachmentRepository } from "../modules/task-attachments/task-attachment.repository";
import { StorageService } from "../common/services/storage.service";
import type { StorageCleanupJobData } from "./storage-cleanup.queue";

async function processCleanupJob(_job: Job<StorageCleanupJobData>) {
  const { retentionDays } = cronConfig.storageCleanup;
  const { storageBucket } = supabaseConfig;

  const attachmentRepo = new TaskAttachmentRepository();
  const storageService = new StorageService();

  console.log(
    `[StorageCleanupWorker] Starting cleanup � scanning attachments of tasks soft-deleted more than ${retentionDays} day(s) ago...`,
  );

  const orphaned = await attachmentRepo.findOrphanedAttachments(retentionDays);

  if (orphaned.length === 0) {
    console.log(
      "[StorageCleanupWorker] No orphaned attachments found. Nothing to clean up.",
    );
    return;
  }

  console.log(
    `[StorageCleanupWorker] Found ${orphaned.length} orphaned attachment(s) to delete.`,
  );

  const successIds: string[] = [];
  const failedPaths: string[] = [];

  // Xoa tung file tren Storage, ghi nhan thanh cong/that bai
  for (const attachment of orphaned) {
    try {
      await storageService.deleteFile(storageBucket, attachment.filePath);
      successIds.push(attachment.id);
      console.log(
        `[StorageCleanupWorker] Deleted storage file: ${attachment.filePath}`,
      );
    } catch (err) {
      // Neu file da bi xoa truoc do (not found), van tinh la thanh cong de xoa DB record
      const errMessage = err instanceof Error ? err.message : String(err);
      if (
        errMessage.toLowerCase().includes("not found") ||
        errMessage.toLowerCase().includes("does not exist")
      ) {
        successIds.push(attachment.id);
        console.warn(
          `[StorageCleanupWorker] File not found on storage (already deleted?): ${attachment.filePath}`,
        );
      } else {
        failedPaths.push(attachment.filePath);
        console.error(
          `[StorageCleanupWorker] Failed to delete storage file: ${attachment.filePath} � ${errMessage}`,
        );
      }
    }
  }

  // Xoa cac DB record da xoa Storage thanh cong
  if (successIds.length > 0) {
    await attachmentRepo.deleteManyByIds(successIds);
    console.log(
      `[StorageCleanupWorker] Deleted ${successIds.length} DB record(s).`,
    );
  }

  if (failedPaths.length > 0) {
    console.warn(
      `[StorageCleanupWorker] ${failedPaths.length} file(s) could not be deleted from storage and will be retried next run:`,
      failedPaths,
    );
  }

  console.log("[StorageCleanupWorker] Cleanup job completed.");
}

export function startStorageCleanupWorker() {
  const worker = new Worker<StorageCleanupJobData>(
    "storage-cleanup-queue",
    processCleanupJob,
    {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      concurrency: 1, // Chi chay 1 job cung luc de tranh conflict
    },
  );

  worker.on("completed", (job) => {
    console.log(`[StorageCleanupWorker] Job ${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[StorageCleanupWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[StorageCleanupWorker] Worker error:", err.message);
  });

  console.log(
    "[StorageCleanupWorker] Worker started � waiting for cleanup jobs...",
  );
  return worker;
}
