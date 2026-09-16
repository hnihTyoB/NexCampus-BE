import { Worker, Job, WorkerOptions } from "bullmq";
import { getRedisConnectionOptions } from "../../config/redis.config";
import { envConfig } from "../../config/env.config";
import { prisma } from "../../database/prisma.client";
import { R2Service } from "../../common/services/r2.service";
import { CleanupJobData, QUEUE_NAMES } from "../index";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

let cleanupWorkerInstance: Worker<CleanupJobData> | undefined;
const r2Service = new R2Service();

function extractKeyFromUrl(url: string, prefix: string): string | null {
  if (!url) return null;
  const idx = url.indexOf(prefix);
  if (idx !== -1) {
    return url.substring(idx);
  }
  return null;
}

export interface CleanupResults {
  orphanedStorage: Record<string, number>;
  expiredDbRecords: {
    passwordResetTokens: number;
    verificationTokens: number;
    expiredApplicationInvites: number;
  };
  durationMs: number;
}

/**
 * Thực hiện dọn dẹp các tệp mồ côi trên Cloudflare R2 theo 5 prefix logic
 */
export async function cleanupOrphanedStorage(
  prefixes: string[] = [
    "tasks/",
    "submissions/",
    "reports/",
    "applications/",
    "avatars/",
  ],
  retentionHours = 2,
): Promise<Record<string, number>> {
  const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
  const deletedCounts: Record<string, number> = {};

  for (const rawPrefix of prefixes) {
    const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
    deletedCounts[prefix] = 0;

    try {
      // 1. Quét toàn bộ objects trên R2 theo prefix
      const storageObjects = await r2Service.listObjects(prefix);
      if (!storageObjects || storageObjects.length === 0) {
        continue;
      }

      // 2. Lấy danh sách tệp đang tham chiếu từ CSDL
      const activeKeys = new Set<string>();

      if (prefix === "tasks/") {
        const records = await prisma.taskAttachment.findMany({
          select: { filePath: true },
        });
        records.forEach((r) => activeKeys.add(r.filePath));
      } else if (prefix === "submissions/") {
        const records = await prisma.submissionAttachment.findMany({
          select: { filePath: true },
        });
        records.forEach((r) => activeKeys.add(r.filePath));

        const submissions = await prisma.taskSubmission.findMany({
          where: { videoDemo: { not: null } },
          select: { videoDemo: true },
        });
        submissions.forEach((s) => {
          if (s.videoDemo) {
            const key = extractKeyFromUrl(s.videoDemo, prefix);
            if (key) activeKeys.add(key);
          }
        });
      } else if (prefix === "reports/") {
        const records = await prisma.reportAttachment.findMany({
          select: { filePath: true },
        });
        records.forEach((r) => activeKeys.add(r.filePath));

        const reports = await prisma.dailyReport.findMany({
          where: { videoDemo: { not: null } },
          select: { videoDemo: true },
        });
        reports.forEach((rep) => {
          if (rep.videoDemo) {
            const key = extractKeyFromUrl(rep.videoDemo, prefix);
            if (key) activeKeys.add(key);
          }
        });
      } else if (prefix === "applications/") {
        const records = await prisma.applicationAttachment.findMany({
          select: { filePath: true },
        });
        records.forEach((r) => activeKeys.add(r.filePath));
      } else if (prefix === "avatars/") {
        const users = await prisma.user.findMany({
          where: { avatarUrl: { not: null } },
          select: { avatarUrl: true },
        });
        users.forEach((u) => {
          if (u.avatarUrl) {
            const key = extractKeyFromUrl(u.avatarUrl, prefix);
            if (key) activeKeys.add(key);
          }
        });
      }

      // 3. Lọc các object mồ côi: không có trong DB và đã tồn tại quá retentionHours
      const orphanedKeys = storageObjects
        .filter((obj) => {
          const isReferenced = activeKeys.has(obj.key);
          const isOlderThanCutoff =
            obj.lastModified ? obj.lastModified < cutoffTime : true;
          return !isReferenced && isOlderThanCutoff;
        })
        .map((obj) => obj.key);

      if (orphanedKeys.length > 0) {
        console.log(
          `[CleanupWorker] Found ${orphanedKeys.length} orphaned file(s) in prefix '${prefix}'. Deleting from R2...`,
        );
        await r2Service.deleteFiles(orphanedKeys);
        deletedCounts[prefix] = orphanedKeys.length;
      }
    } catch (err: any) {
      console.error(
        `[CleanupWorker] Error while cleaning prefix '${prefix}':`,
        err.message,
      );
    }
  }

  return deletedCounts;
}

/**
 * Dọn dẹp các token và dữ liệu hết hạn trong Database
 */
export async function cleanupExpiredDatabaseRecords(): Promise<{
  passwordResetTokens: number;
  verificationTokens: number;
  expiredApplicationInvites: number;
}> {
  const now = new Date();

  // 1. Xóa PasswordResetToken đã hết hạn
  const resetTokenResult = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  // 2. Xóa VerificationToken đã hết hạn
  const verificationTokenResult = await prisma.verificationToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  // 3. Cập nhật hoặc dọn dẹp các ApplicationInvite đã hết hạn quá 30 ngày
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inviteResult = await prisma.applicationInvite.deleteMany({
    where: {
      status: { in: ["UNUSED", "ACTIVE", "EXPIRED"] },
      expiresAt: { lt: thirtyDaysAgo },
    },
  });

  return {
    passwordResetTokens: resetTokenResult.count,
    verificationTokens: verificationTokenResult.count,
    expiredApplicationInvites: inviteResult.count,
  };
}

export async function processCleanupJob(
  job: Job<CleanupJobData>,
): Promise<CleanupResults> {
  const startTime = Date.now();
  const { type, prefixes, retentionHours } = job.data;

  console.log(
    `[CleanupWorker] Starting cleanup job #${job.id} (type: ${type || "FULL_CLEANUP"})...`,
  );

  let orphanedStorage: Record<string, number> = {};
  let expiredDbRecords = {
    passwordResetTokens: 0,
    verificationTokens: 0,
    expiredApplicationInvites: 0,
  };

  if (type === "STORAGE_ORPHANS" || type === "FULL_CLEANUP") {
    orphanedStorage = await cleanupOrphanedStorage(
      prefixes,
      retentionHours ?? 2,
    );
  }

  if (type === "EXPIRED_DATA" || type === "FULL_CLEANUP") {
    expiredDbRecords = await cleanupExpiredDatabaseRecords();
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[CleanupWorker] ✅ Cleanup job #${job.id} completed in ${durationMs}ms:`,
    {
      storage: orphanedStorage,
      db: expiredDbRecords,
    },
  );

  return {
    orphanedStorage,
    expiredDbRecords,
    durationMs,
  };
}

export function startCleanupWorker(): Worker<CleanupJobData> | undefined {
  if (isTestEnv || !envConfig.redis.enabled) {
    console.log(
      "[CleanupWorker] Skipped starting worker in test/offline environment.",
    );
    return undefined;
  }

  if (cleanupWorkerInstance) {
    return cleanupWorkerInstance;
  }

  const workerOptions: WorkerOptions = {
    connection: getRedisConnectionOptions() as any,
    concurrency: 1, // Chạy tuần tự 1 job dọn dẹp để bảo vệ tài nguyên DB và R2
  };

  cleanupWorkerInstance = new Worker<CleanupJobData>(
    QUEUE_NAMES.CLEANUP,
    processCleanupJob,
    workerOptions,
  );

  cleanupWorkerInstance.on("completed", (job) => {
    console.log(`[CleanupWorker] Job #${job.id} [${job.name}] finished.`);
  });

  cleanupWorkerInstance.on("failed", (job, err) => {
    console.error(
      `[CleanupWorker] Job #${job?.id} [${job?.name}] failed: ${err.message}`,
    );
  });

  cleanupWorkerInstance.on("error", (err) => {
    if (envConfig.nodeEnv !== "production") {
      console.warn("[CleanupWorker] Worker error:", err.message);
    }
  });

  console.log("[CleanupWorker] Worker started and listening on cleanup-queue");
  return cleanupWorkerInstance;
}

export async function stopCleanupWorker(): Promise<void> {
  if (cleanupWorkerInstance) {
    await cleanupWorkerInstance.close().catch(() => {});
    cleanupWorkerInstance = undefined;
    console.log("[CleanupWorker] Worker stopped cleanly.");
  }
}
