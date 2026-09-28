import { CronRepository, cronRepository } from "./cron.repository";
import { R2Service } from "../../common/services/r2.service";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  CRON_JOB_NAMES,
  CronJobName,
  DEFAULT_CRON_SCHEDULES,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS,
} from "../../common/constants/cron.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import {
  EMAIL_TEMPLATE_KEY,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";
import {
  formatVietnamDate,
  getVietnamDayRange,
  getVietnamToday,
} from "../../common/helpers/date.helper";
import { CronJobExecutionResultDto, CronJobItemDto, ToggleCronJobResponseDto } from "./cron.dto";
import { cronQueue } from "../../common/queues/cron.queue";
import { prisma } from "../../database/prisma.client";
import { AbsenceStatus } from "@prisma/client";

export class CronService {
  /**
   * Tập hợp các job đang bị vô hiệu hóa (lưu in-memory, reset khi restart server)
   * Nếu muốn bền vững hơn, có thể đưa vào Redis hoặc DB sau.
   */
  private readonly disabledJobs = new Set<CronJobName>();

  constructor(
    private readonly repository: CronRepository = cronRepository,
    private readonly r2Service: R2Service = new R2Service(),
  ) {}

  /**
   * Danh sách toàn bộ các tác vụ định kỳ đã đăng ký trong hệ thống
   */
  async listJobs(search?: string): Promise<CronJobItemDto[]> {
    const jobs: CronJobItemDto[] = Object.entries(DEFAULT_CRON_SCHEDULES).map(
      ([name, config]) => ({
        name: name as CronJobName,
        cron: config.cron,
        description: config.description,
        isEnabled: !this.disabledJobs.has(name as CronJobName),
        lastStatus: "READY",
      }),
    );

    if (search) {
      const lower = search.toLowerCase();
      return jobs.filter(
        (j) =>
          j.name.toLowerCase().includes(lower) ||
          j.description.toLowerCase().includes(lower),
      );
    }

    return jobs;
  }

  /**
   * Bật / Tắt lịch chạy tự động của một Cron Job
   */
  async toggleJob(
    jobName: CronJobName,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<ToggleCronJobResponseDto> {
    const wasDisabled = this.disabledJobs.has(jobName);

    if (wasDisabled) {
      // Đang tắt → Bật lên
      this.disabledJobs.delete(jobName);
      await cronQueue.enableJobScheduler(jobName);
    } else {
      // Đang bật → Tắt đi
      this.disabledJobs.add(jobName);
      await cronQueue.disableJobScheduler(jobName);
    }

    const isEnabled = !this.disabledJobs.has(jobName);

    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: isEnabled ? AUDIT_ACTION.ENABLE_CRON_JOB : AUDIT_ACTION.DISABLE_CRON_JOB,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: jobName,
      details: { isEnabled },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return {
      jobName,
      isEnabled,
      message: isEnabled
        ? `Lịch chạy tự động của '${jobName}' đã được BẬT`
        : `Lịch chạy tự động của '${jobName}' đã được TẮT`,
    };
  }

  /**
   * 1. Dọn dẹp các bản ghi Audit Logs cũ hơn số ngày quy định (mặc định 30 ngày)
   */
  async executeAuditLogCleanup(
    retentionDays = DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  ): Promise<{
    deletedCount: number;
    retentionDays: number;
    cutoffDate: string;
  }> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const deletedCount =
      await this.repository.deleteAuditLogsOlderThan(cutoffDate);

    // Ghi audit log hệ thống về việc dọn dẹp
    await this.repository.createAuditLog({
      action: AUDIT_ACTION.CLEANUP_AUDIT_LOGS,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      details: {
        deletedCount,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
    });

    return {
      deletedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * 2. Quét và dọn dẹp các file tải lên không xác nhận / rác trên Cloudflare R2 / S3
   */
  async executeUploadsCleanup(
    maxAgeHours = DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS,
  ): Promise<{
    scannedCount: number;
    deletedCount: number;
    deletedKeys: string[];
  }> {
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    // Lấy toàn bộ danh sách file trong thư mục avatars/
    const objects = await this.r2Service.listObjects("avatars/");
    if (objects.length === 0) {
      return { scannedCount: 0, deletedCount: 0, deletedKeys: [] };
    }

    // Lấy toàn bộ các avatarUrl đang được User trong cơ sở dữ liệu liên kết
    const activeUrls = await this.repository.getAllUserAvatarUrls();
    const activeKeySet = new Set<string>();

    for (const url of activeUrls) {
      // url có dạng https://.../avatars/user-id/xyz.webp -> lấy 'avatars/user-id/xyz.webp'
      const match = url.match(/avatars\/.+$/);
      if (match) {
        activeKeySet.add(match[0]);
      }
    }

    const deletedKeys: string[] = [];

    for (const obj of objects) {
      // Nếu file chưa từng được liên kết với bất kỳ User nào và đã tồn tại quá maxAgeHours
      const isOrphaned = !activeKeySet.has(obj.key);
      const isOldEnough = obj.lastModified
        ? now - obj.lastModified.getTime() > maxAgeMs
        : false;

      if (isOrphaned && isOldEnough) {
        deletedKeys.push(obj.key);
      }
    }

    if (deletedKeys.length > 0) {
      if (typeof this.r2Service.deleteFiles === "function") {
        await this.r2Service.deleteFiles(deletedKeys).catch((err) => {
          console.warn(
            `[CronService] Failed to batch delete orphaned files:`,
            err.message,
          );
        });
      } else {
        for (const key of deletedKeys) {
          await this.r2Service.deleteFile(key).catch(() => {});
        }
      }
    }

    if (deletedKeys.length > 0) {
      await this.repository.createAuditLog({
        action: AUDIT_ACTION.CLEANUP_UNCONFIRMED_UPLOADS,
        targetType: AUDIT_TARGET_TYPE.CRON_JOB,
        targetId: CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS,
        details: {
          scannedCount: objects.length,
          deletedCount: deletedKeys.length,
          maxAgeHours,
        },
      });
    }

    return {
      scannedCount: objects.length,
      deletedCount: deletedKeys.length,
      deletedKeys,
    };
  }

  /**
   * 3. Dọn dẹp định kỳ các Token xác thực và phiên đã hết hạn
   */
  async executeExpiredTokensCleanup(): Promise<{
    refreshTokensCount: number;
    verificationTokensCount: number;
    passwordResetTokensCount: number;
    totalDeleted: number;
  }> {
    const now = new Date();
    const result = await this.repository.deleteExpiredTokens(now);
    const totalDeleted =
      result.refreshTokensCount +
      result.verificationTokensCount +
      result.passwordResetTokensCount;

    if (totalDeleted > 0) {
      await this.repository.createAuditLog({
        action: AUDIT_ACTION.CLEANUP_EXPIRED_TOKENS,
        targetType: AUDIT_TARGET_TYPE.CRON_JOB,
        targetId: CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS,
        details: { ...result, totalDeleted },
      });
    }

    return {
      ...result,
      totalDeleted,
    };
  }

  /**
   * 4. Tổng hợp hoạt động định kỳ (Hàng ngày / Hàng tuần) và gửi email báo cáo tới Quản trị viên
   */
  async executeSummaryDigest(options: { period: "DAILY" | "WEEKLY" }): Promise<{
    period: "DAILY" | "WEEKLY";
    startDate: string;
    endDate: string;
    stats: any;
    recipientCount: number;
  }> {
    const durationDays = options.period === "WEEKLY" ? 7 : 1;
    const prevDate = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);
    const startDateStr = formatVietnamDate(prevDate);
    const endDateStr = formatVietnamDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    const { startOfDay: startDate } = getVietnamDayRange(startDateStr);
    const { endOfDay: endDate } = getVietnamDayRange(endDateStr);

    const stats = await this.repository.getActivityStats(startDate, endDate);
    const admins = await this.repository.findAdminUsers();

    const periodText = options.period === "WEEKLY" ? "Hàng tuần" : "Hàng ngày";

    for (const admin of admins) {
      if (admin.email) {
        await notificationDispatcher
          .send({
            userId: admin.id,
            channels: [NOTIFICATION_CHANNEL.EMAIL],
            email: {
              toEmail: admin.email,
              templateKey: EMAIL_TEMPLATE_KEY.ACTIVITY_SUMMARY_DIGEST,
              templateData: {
                period: periodText,
                startDate: startDateStr,
                endDate: endDateStr,
                ...stats,
              },
            },
          })
          .catch((err: any) => {
            console.warn(
              `[CronService] Failed to send digest email to ${admin.email}:`,
              err.message,
            );
          });
      }
    }

    await this.repository.createAuditLog({
      action: AUDIT_ACTION.SEND_SUMMARY_DIGEST,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId:
        options.period === "WEEKLY"
          ? CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST
          : CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST,
      details: { period: options.period, stats, recipientCount: admins.length },
    });

    return {
      period: options.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats,
      recipientCount: admins.length,
    };
  }

  /**
   * 5. Nhắc nhở nộp báo cáo tiến độ ngày cho thực tập sinh (Tự động miễn trừ chuông cho người có phép đã duyệt)
   */
  async executeRemindDailyReports(): Promise<{
    remindedCount: number;
    bypassedCount: number;
    bypassedInterns: string[];
  }> {
    const today = getVietnamToday();
    const todayStr = formatVietnamDate(today);

    // Lấy danh sách thực tập sinh đang hoạt động
    const activeInterns = await prisma.intern.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (activeInterns.length === 0) {
      return { remindedCount: 0, bypassedCount: 0, bypassedInterns: [] };
    }

    // Lấy danh sách intern đã nộp report hôm nay
    const submittedReports = await prisma.dailyReport.findMany({
      where: {
        date: today,
      },
      select: { internId: true },
    });
    const submittedInternIds = new Set(submittedReports.map((r) => r.internId));

    // Lấy danh sách intern có đơn nghỉ phép APPROVED bao trùm ngày hôm nay (cả ngày hoặc nhiều ngày)
    const approvedLeaves = await prisma.absence.findMany({
      where: {
        status: AbsenceStatus.APPROVED,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { userId: true, durationUnit: true },
    });

    // Các intern nghỉ cả ngày hoặc nhiều ngày được miễn trừ hoàn toàn
    const excusedUserIds = new Set(
      approvedLeaves
        .filter((l) => l.durationUnit === "FULL_DAY" || l.durationUnit === "MULTI_DAY")
        .map((l) => l.userId),
    );

    let remindedCount = 0;
    let bypassedCount = 0;
    const bypassedInterns: string[] = [];

    for (const intern of activeInterns) {
      // Đã nộp report -> không cần nhắc
      if (submittedInternIds.has(intern.id)) {
        continue;
      }

      // Có đơn nghỉ phép đã duyệt cả ngày -> Miễn trừ chuông cảnh báo và email!
      if (excusedUserIds.has(intern.userId)) {
        bypassedCount++;
        bypassedInterns.push(intern.user.fullName || intern.id);
        continue;
      }

      // Gửi thông báo nhắc nhở nộp báo cáo ngày
      remindedCount++;
      await notificationDispatcher
        .send({
          userId: intern.userId,
          channels: [NOTIFICATION_CHANNEL.WEB],
          web: {
            type: NOTIFICATION_TYPE.WARNING,
            title: "Nhắc nhở nộp báo cáo ngày",
            content: `Đã 17:00 rồi! Đừng quên nộp báo cáo tiến độ ngày hôm nay (${todayStr}) trước giờ kết thúc ca nhé!`,
            actionUrl: "/intern/daily-report",
          },
          email: intern.user.email
            ? {
                toEmail: intern.user.email,
                templateKey: EMAIL_TEMPLATE_KEY.CUSTOM,
                templateData: {
                  subject: `[NexCampus] Nhắc nhở nộp báo cáo ngày hôm nay (${todayStr})`,
                  title: "Nhắc nhở nộp báo cáo ngày",
                  content: `Xin chào ${intern.user.fullName || "bạn"}, đừng quên nộp báo cáo tiến độ ngày hôm nay trước giờ kết thúc ca làm việc nhé!`,
                  actionUrl: "/intern/daily-report",
                },
              }
            : undefined,
        })
        .catch((err: any) => {
          console.warn(
            `[CronService] Failed to send daily reminder to intern ${intern.id}:`,
            err.message,
          );
        });
    }

    return {
      remindedCount,
      bypassedCount,
      bypassedInterns,
    };
  }

  /**
   * Kích hoạt chạy ngay một Cron Job bất kỳ (Manual trigger từ Admin)
   */
  async triggerJob(
    jobName: CronJobName,
    params: Record<string, unknown> = {},
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<CronJobExecutionResultDto> {
    const startTime = Date.now();

    let executionData: Record<string, unknown> | undefined;

    switch (jobName) {
      case CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS: {
        const days =
          typeof params["retentionDays"] === "number"
            ? params["retentionDays"]
            : DEFAULT_AUDIT_LOG_RETENTION_DAYS;
        executionData = await this.executeAuditLogCleanup(days);
        break;
      }
      case CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS: {
        const hours =
          typeof params["maxAgeHours"] === "number"
            ? params["maxAgeHours"]
            : DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS;
        executionData = await this.executeUploadsCleanup(hours);
        break;
      }
      case CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS: {
        executionData = await this.executeExpiredTokensCleanup();
        break;
      }
      case CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST: {
        executionData = await this.executeSummaryDigest({ period: "DAILY" });
        break;
      }
      case CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST: {
        executionData = await this.executeSummaryDigest({ period: "WEEKLY" });
        break;
      }
      case CRON_JOB_NAMES.REMIND_DAILY_REPORT: {
        executionData = await this.executeRemindDailyReports();
        break;
      }
      default:
        throw new Error(`Job name '${jobName}' không được hỗ trợ`);
    }

    const durationMs = Date.now() - startTime;

    // Ghi Audit Log hành động trigger của Admin
    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTION.TRIGGER_CRON_JOB,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: jobName,
      details: { params, durationMs, result: executionData },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return {
      jobName,
      success: true,
      durationMs,
      data: executionData,
    };
  }
}

export const cronService = new CronService();
