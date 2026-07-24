import { Worker, Job } from "bullmq";
import { redisConfig } from "../config/redis.config";
import { supabaseConfig } from "../config/supabase.config";
import { cronConfig } from "../config/cron.config";
import { TaskAttachmentRepository } from "../modules/task-attachments/task-attachment.repository";
import { SubmissionAttachmentRepository } from "../modules/submission-attachments/submission-attachment.repository";
import { ReportAttachmentRepository } from "../modules/report-attachments/report-attachment.repository";
import { UserRepository } from "../modules/users/user.repository";
import { prisma } from "../database/prisma.client";
import { StorageService } from "../common/services/storage.service";
import type { StorageCleanupJobData } from "./storage-cleanup.queue";

async function processCleanupJob(_job: Job<StorageCleanupJobData>) {
  const { retentionDays } = cronConfig.storageCleanup;
  const storageService = new StorageService();

  console.log(
    `[StorageCleanupWorker] Starting cleanup processes (retention: ${retentionDays} days)...`,
  );

  // 1. Dọn dẹp Task Attachments
  try {
    const bucket = supabaseConfig.storageBucket;
    const repo = new TaskAttachmentRepository();
    const orphaned = await repo.findOrphanedAttachments(retentionDays);
    if (orphaned.length > 0) {
      console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned task attachment(s) to delete.`);
      const successIds: string[] = [];
      for (const attachment of orphaned) {
        try {
          await storageService.deleteFile(bucket, attachment.filePath);
          successIds.push(attachment.id);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("does not exist")) {
            successIds.push(attachment.id);
          } else {
            console.error(`[StorageCleanupWorker] Failed to delete task file: ${attachment.filePath} - ${errMessage}`);
          }
        }
      }
      if (successIds.length > 0) {
        await repo.deleteManyByIds(successIds);
        console.log(`[StorageCleanupWorker] Deleted ${successIds.length} task attachment DB record(s).`);
      }
    } else {
      console.log("[StorageCleanupWorker] No orphaned task attachments found.");
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in task attachments cleanup:", err);
  }

  // 2. Dọn dẹp Submission Attachments
  try {
    const bucket = supabaseConfig.storageSubmissionBucket;
    const repo = new SubmissionAttachmentRepository();
    const orphaned = await repo.findOrphanedAttachments(retentionDays);
    if (orphaned.length > 0) {
      console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned submission attachment(s) to delete.`);
      const successIds: string[] = [];
      for (const attachment of orphaned) {
        try {
          await storageService.deleteFile(bucket, attachment.filePath);
          successIds.push(attachment.id);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("does not exist")) {
            successIds.push(attachment.id);
          } else {
            console.error(`[StorageCleanupWorker] Failed to delete submission file: ${attachment.filePath} - ${errMessage}`);
          }
        }
      }
      if (successIds.length > 0) {
        await repo.deleteManyByIds(successIds);
        console.log(`[StorageCleanupWorker] Deleted ${successIds.length} submission attachment DB record(s).`);
      }
    } else {
      console.log("[StorageCleanupWorker] No orphaned submission attachments found.");
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in submission attachments cleanup:", err);
  }

  // 3. Dọn dẹp Report Attachments (Xóa tất cả báo cáo cũ hơn 30 ngày)
  try {
    const bucket = supabaseConfig.storageReportBucket;
    const repo = new ReportAttachmentRepository();
    const oldAttachments = await repo.findOldAttachments(retentionDays);
    if (oldAttachments.length > 0) {
      console.log(`[StorageCleanupWorker] Found ${oldAttachments.length} old report attachment(s) to delete.`);
      const successIds: string[] = [];
      for (const attachment of oldAttachments) {
        try {
          await storageService.deleteFile(bucket, attachment.filePath);
          successIds.push(attachment.id);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("does not exist")) {
            successIds.push(attachment.id);
          } else {
            console.error(`[StorageCleanupWorker] Failed to delete report file: ${attachment.filePath} - ${errMessage}`);
          }
        }
      }
      if (successIds.length > 0) {
        await repo.deleteManyByIds(successIds);
        console.log(`[StorageCleanupWorker] Deleted ${successIds.length} report attachment DB record(s).`);
      }
    } else {
      console.log("[StorageCleanupWorker] No old report attachments found.");
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in report attachments cleanup:", err);
  }

  // 4. Dọn dẹp User Avatars
  try {
    const bucket = supabaseConfig.storageAvatarBucket;
    const repo = new UserRepository();
    const orphaned = await repo.findOrphanedAvatars(retentionDays);
    if (orphaned.length > 0) {
      console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned user avatar(s) to delete.`);
      const prefix = `${supabaseConfig.url}/storage/v1/object/public/${bucket}/`;
      const successIds: string[] = [];
      for (const user of orphaned) {
        if (!user.avatarUrl) continue;
        let avatarPath = user.avatarUrl;
        if (avatarPath.startsWith(prefix)) {
          avatarPath = avatarPath.replace(prefix, "");
        }
        try {
          await storageService.deleteFile(bucket, avatarPath);
          successIds.push(user.id);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("does not exist")) {
            successIds.push(user.id);
          } else {
            console.error(`[StorageCleanupWorker] Failed to delete avatar file: ${avatarPath} - ${errMessage}`);
          }
        }
      }
      if (successIds.length > 0) {
        await repo.clearAvatarUrls(successIds);
        console.log(`[StorageCleanupWorker] Cleared avatarUrl in DB for ${successIds.length} user(s).`);
      }
    } else {
      console.log("[StorageCleanupWorker] No orphaned user avatars found.");
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in user avatars cleanup:", err);
  }

  // 5. Dọn dẹp Expired Export PDFs
  try {
    const bucket = supabaseConfig.storageReportBucket || "report-attachments";
    const now = new Date();
    const expiredExports = await prisma.exportHistory.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        storagePath: true,
      },
    });

    if (expiredExports.length > 0) {
      console.log(`[StorageCleanupWorker] Found ${expiredExports.length} expired export PDF(s) to delete.`);
      const successIds: string[] = [];
      for (const exp of expiredExports) {
        try {
          await storageService.deleteFile(bucket, exp.storagePath);
          successIds.push(exp.id);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("does not exist")) {
            successIds.push(exp.id);
          } else {
            console.error(`[StorageCleanupWorker] Failed to delete expired export file: ${exp.storagePath} - ${errMessage}`);
          }
        }
      }
      if (successIds.length > 0) {
        await prisma.exportHistory.deleteMany({
          where: { id: { in: successIds } },
        });
        console.log(`[StorageCleanupWorker] Deleted ${successIds.length} expired export DB record(s).`);
      }
    } else {
      console.log("[StorageCleanupWorker] No expired export PDFs found.");
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in expired exports cleanup:", err);
  }

  // 6. Dọn dẹp tệp tin mồ côi (Orphaned Files Cleanup)
  try {
    console.log("[StorageCleanupWorker] Starting orphaned files scanning & cleanup...");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // 6.1. Task Attachments bucket
    try {
      const bucket = supabaseConfig.storageBucket;
      const dbAttachments = await prisma.taskAttachment.findMany({
        select: { filePath: true },
      });
      const dbFilePaths = new Set(dbAttachments.map((a) => a.filePath));
      const storageFiles = await storageService.listAllFiles(bucket);

      const orphaned = storageFiles.filter(
        (f) => !dbFilePaths.has(f.path) && new Date(f.created_at) < twoHoursAgo
      );

      if (orphaned.length > 0) {
        console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned file(s) in task bucket. Deleting...`);
        for (const file of orphaned) {
          try {
            await storageService.deleteFile(bucket, file.path);
            console.log(`[StorageCleanupWorker] Deleted orphaned task file: ${file.path}`);
          } catch (err) {
            console.error(`[StorageCleanupWorker] Failed to delete orphaned task file ${file.path}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[StorageCleanupWorker] Error cleaning orphaned task files:", err);
    }

    // 6.2. Submission Attachments bucket
    try {
      const bucket = supabaseConfig.storageSubmissionBucket;
      const dbAttachments = await prisma.submissionAttachment.findMany({
        select: { filePath: true },
      });
      const dbFilePaths = new Set(dbAttachments.map((a) => a.filePath));
      const storageFiles = await storageService.listAllFiles(bucket);

      const orphaned = storageFiles.filter(
        (f) => !dbFilePaths.has(f.path) && new Date(f.created_at) < twoHoursAgo
      );

      if (orphaned.length > 0) {
        console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned file(s) in submission bucket. Deleting...`);
        for (const file of orphaned) {
          try {
            await storageService.deleteFile(bucket, file.path);
            console.log(`[StorageCleanupWorker] Deleted orphaned submission file: ${file.path}`);
          } catch (err) {
            console.error(`[StorageCleanupWorker] Failed to delete orphaned submission file ${file.path}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[StorageCleanupWorker] Error cleaning orphaned submission files:", err);
    }

    // 6.3. Report Attachments bucket (Includes ReportAttachment and ExportHistory)
    try {
      const bucket = supabaseConfig.storageReportBucket;
      const dbAttachments = await prisma.reportAttachment.findMany({
        select: { filePath: true },
      });
      const dbExports = await prisma.exportHistory.findMany({
        select: { storagePath: true },
      });
      const dbFilePaths = new Set([
        ...dbAttachments.map((a) => a.filePath),
        ...dbExports.map((e) => e.storagePath),
      ]);
      const storageFiles = await storageService.listAllFiles(bucket);

      const orphaned = storageFiles.filter(
        (f) => !dbFilePaths.has(f.path) && new Date(f.created_at) < twoHoursAgo
      );

      if (orphaned.length > 0) {
        console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned file(s) in report bucket. Deleting...`);
        for (const file of orphaned) {
          try {
            await storageService.deleteFile(bucket, file.path);
            console.log(`[StorageCleanupWorker] Deleted orphaned report/export file: ${file.path}`);
          } catch (err) {
            console.error(`[StorageCleanupWorker] Failed to delete orphaned report/export file ${file.path}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[StorageCleanupWorker] Error cleaning orphaned report/export files:", err);
    }

    // 6.4. User Avatars bucket
    try {
      const bucket = supabaseConfig.storageAvatarBucket;
      const dbUsers = await prisma.user.findMany({
        where: { avatarUrl: { not: null } },
        select: { avatarUrl: true },
      });
      const prefix = `${supabaseConfig.url}/storage/v1/object/public/${bucket}/`;
      const dbFilePaths = new Set(
        dbUsers
          .map((u) => u.avatarUrl)
          .filter((url): url is string => !!url && url.startsWith(prefix))
          .map((url) => url.replace(prefix, ""))
      );
      const storageFiles = await storageService.listAllFiles(bucket);

      const orphaned = storageFiles.filter(
        (f) => !dbFilePaths.has(f.path) && new Date(f.created_at) < twoHoursAgo
      );

      if (orphaned.length > 0) {
        console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned file(s) in avatar bucket. Deleting...`);
        for (const file of orphaned) {
          try {
            await storageService.deleteFile(bucket, file.path);
            console.log(`[StorageCleanupWorker] Deleted orphaned avatar file: ${file.path}`);
          } catch (err) {
            console.error(`[StorageCleanupWorker] Failed to delete orphaned avatar file ${file.path}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[StorageCleanupWorker] Error cleaning orphaned avatar files:", err);
    }

    // 6.5. Application Attachments bucket
    try {
      const bucket = "application-attachments";
      const dbAttachments = await prisma.applicationAttachment.findMany({
        select: { filePath: true },
      });
      const dbFilePaths = new Set(dbAttachments.map((a) => a.filePath));
      const storageFiles = await storageService.listAllFiles(bucket);

      const orphaned = storageFiles.filter(
        (f) => !dbFilePaths.has(f.path) && new Date(f.created_at) < twoHoursAgo
      );

      if (orphaned.length > 0) {
        console.log(`[StorageCleanupWorker] Found ${orphaned.length} orphaned file(s) in application bucket. Deleting...`);
        for (const file of orphaned) {
          try {
            await storageService.deleteFile(bucket, file.path);
            console.log(`[StorageCleanupWorker] Deleted orphaned application file: ${file.path}`);
          } catch (err) {
            console.error(`[StorageCleanupWorker] Failed to delete orphaned application file ${file.path}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[StorageCleanupWorker] Error cleaning orphaned application files:", err);
    }
  } catch (err) {
    console.error("[StorageCleanupWorker] Error in overall orphaned files cleanup:", err);
  }

  console.log("[StorageCleanupWorker] All cleanup jobs completed.");
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
    "[StorageCleanupWorker] Worker started waiting for cleanup jobs...",
  );
  return worker;
}
