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
import { AbsenceStatus, MeetingStatus } from "@prisma/client";
import { discordWebhookService } from "../../common/services/discord-webhook.service";
import { DISCORD_WEBHOOK_PURPOSE } from "../../common/constants/discord.constant";

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
   * Tích hợp tự động bắn Discord Webhook theo Phòng ban:
   * - 17:30 (Nhắc nhở đợt 1 / phase = 'REMINDER'): Bắn Embed màu Vàng/Cam (#FEE75C) tag Role phòng ban
   * - 18:30 (Điểm danh chốt ca / phase = 'CLOSING'): Bắn Embed màu Đỏ Cam danh sách những ai chưa nộp, tag đích danh
   */
  async executeRemindDailyReports(params: { phase?: "REMINDER" | "CLOSING" } = {}): Promise<{
    remindedCount: number;
    bypassedCount: number;
    bypassedInterns: string[];
    discordNotifiedDepartments?: number;
  }> {
    const today = getVietnamToday();
    const todayStr = formatVietnamDate(today);

    // Lấy danh sách thực tập sinh đang hoạt động kèm phòng ban
    const activeInterns = await prisma.intern.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (activeInterns.length === 0) {
      return { remindedCount: 0, bypassedCount: 0, bypassedInterns: [], discordNotifiedDepartments: 0 };
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

    // Nhóm thực tập sinh chưa nộp theo từng Phòng ban để gửi Discord Webhook
    const missingByDepartment = new Map<string, { departmentName: string; interns: any[] }>();
    const allDepartmentsWithActiveInterns = new Map<string, string>();

    for (const intern of activeInterns) {
      if (intern.departmentId && intern.department?.name) {
        allDepartmentsWithActiveInterns.set(intern.departmentId, intern.department.name);
      }

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

      // Intern chưa nộp và không có phép
      remindedCount++;

      if (intern.departmentId && intern.department?.name) {
        const currentGroup = missingByDepartment.get(intern.departmentId) || {
          departmentName: intern.department.name,
          interns: [],
        };
        currentGroup.interns.push({
          fullName: intern.user.fullName || intern.fullName || intern.id,
          discordUsername: intern.discordUsername,
          internCode: intern.internCode,
        });
        missingByDepartment.set(intern.departmentId, currentGroup);
      }

      // Gửi thông báo Web in-app & Email cá nhân nếu ở phase REMINDER
      if (params.phase !== "CLOSING") {
        await notificationDispatcher
          .send({
            userId: intern.userId,
            channels: [NOTIFICATION_CHANNEL.WEB],
            web: {
              type: NOTIFICATION_TYPE.WARNING,
              title: "Nhắc nhở nộp báo cáo ngày",
              content: `Đã 17:30 rồi! Đừng quên nộp báo cáo tiến độ ngày hôm nay (${todayStr}) trước giờ kết thúc ca nhé!`,
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
    }

    // ── Bắn thông báo Discord Webhook theo phân luồng Phòng ban ──────────────
    let discordNotifiedDepartments = 0;

    if (params.phase === "CLOSING") {
      // 18:30 — Chốt ca điểm danh: Bắn danh sách chưa nộp vào kênh của từng phòng ban
      for (const [deptId, deptName] of allDepartmentsWithActiveInterns.entries()) {
        const missingData = missingByDepartment.get(deptId);
        const missingList = missingData ? missingData.interns : [];
        const sent = await discordWebhookService.notifyDailyStandupClosing({
          departmentId: deptId,
          departmentName: deptName,
          missingInterns: missingList,
        });
        if (sent) discordNotifiedDepartments++;
      }
    } else {
      // 17:30 — Nhắc nhở đợt 1: Bắn Embed vàng nhắc nhở vào kênh của từng phòng ban
      for (const [deptId, deptName] of allDepartmentsWithActiveInterns.entries()) {
        const sent = await discordWebhookService.notifyDailyStandupReminder({
          departmentId: deptId,
          departmentName: deptName,
        });
        if (sent) discordNotifiedDepartments++;
      }
    }

    return {
      remindedCount,
      bypassedCount,
      bypassedInterns,
      discordNotifiedDepartments,
    };
  }

  /**
   * 5.1. Smart Standup Executive Summary (Báo cáo thông minh cho Leader lúc 18:45 hàng ngày)
   * Thống kê:
   * - Tổng số Intern đang ACTIVE.
   * - Số lượng đã nộp DailyReport trong ngày hôm nay.
   * - Danh sách Intern có đơn Absence ở trạng thái APPROVED (kèm tên và lý do xin nghỉ).
   * - Danh sách các TaskAssignment đang có status = 'BLOCKED' hoặc có blockedReason != null phát sinh/cập nhật trong ngày.
   * - Danh sách các TaskExtensionRequest đang có status = 'PENDING'.
   * Gắn kèm 2 nút Action Row:
   * [ 🛠️ Gỡ Rối Task Block ] ➔ ${appUrl}/leader/tasks?status=BLOCKED
   * [ ⏳ Duyệt Đơn Gia Hạn ] ➔ ${appUrl}/leader/tasks?tab=extensions
   * Bắn thông báo vào Webhook của kênh #leader-hq-alerts hoặc Webhook của từng phòng ban.
   */
  async executeDailyStandupExecutiveSummary(params: { departmentId?: string } = {}): Promise<{
    summaryDate: string;
    totalActiveInterns: number;
    submittedCount: number;
    completionRate: number;
    approvedAbsencesCount: number;
    blockedTasksCount: number;
    pendingExtensionsCount: number;
    dispatchedWebhooksCount: number;
  }> {
    const today = getVietnamToday();
    const { startOfDay, endOfDay } = getVietnamDayRange(today);
    const todayStr = formatVietnamDate(today);

    // 1. Lấy dữ liệu tổng hợp Standup thông qua repository
    const execData = await this.repository.getDailyStandupExecutiveData({
      startOfDay,
      endOfDay,
      today,
      departmentId: params.departmentId,
    });

    const activeInterns = execData.activeInterns;
    const submittedReports = execData.submittedReports;
    const approvedAbsencesData = execData.approvedAbsencesData;
    const blockedAssignments = execData.blockedAssignments;
    const pendingExtensionsData = execData.pendingExtensionsData;
    const deptConfigs = execData.deptWebhookConfigs;

    const submittedCount = new Set(submittedReports.map((r) => r.internId)).size;
    const totalActiveInterns = activeInterns.length;
    const completionRate =
      totalActiveInterns > 0
        ? Math.round((submittedCount / totalActiveInterns) * 100)
        : 100;

    const approvedAbsences = approvedAbsencesData.map((a) => ({
      internName:
        a.user?.intern?.fullName ||
        a.user?.fullName ||
        "Thực tập sinh",
      internCode: a.user?.intern?.internCode,
      departmentName: a.user?.intern?.department?.name,
      reason: a.reason || "Lý do cá nhân",
    }));

    const blockedTasks = blockedAssignments.map((b) => ({
      taskId: b.taskId,
      taskCode: b.task?.code,
      taskTitle: b.task?.title || "Nhiệm vụ",
      internName: b.intern?.fullName || "Chưa phân công",
      blockedReason: b.blockedReason || "Không rõ lý do",
    }));

    const pendingExtensions = pendingExtensionsData.map((e) => ({
      requestId: e.id,
      taskId: e.assignment.taskId,
      taskCode: e.assignment.task?.code,
      taskTitle: e.assignment.task?.title || "Nhiệm vụ",
      internName: e.intern?.fullName || "Thực tập sinh",
      extensionDays: e.extensionDays,
    }));

    // 2. Gửi báo cáo tới Webhook:
    // Ưu tiên Webhook Global kênh #leader-hq-alerts (purpose = LEADER_ALERTS),
    // hoặc Webhook của từng phòng ban nếu không có kênh Global.
    let dispatchedWebhooksCount = 0;
    const targetWebhooks: Array<{ url: string; threadId?: string | null; name?: string }> = [];

    if (params.departmentId) {
      const deptWebhook = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
        departmentId: params.departmentId,
      });
      if (deptWebhook) {
        targetWebhooks.push({
          url: deptWebhook.webhookUrl,
          threadId: (deptWebhook as any).threadId,
          name: "Department Leader Alerts",
        });
      }
    } else {
      // 1. Kiểm tra Global #leader-hq-alerts
      const globalLeaderWebhook = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
      });

      if (globalLeaderWebhook) {
        targetWebhooks.push({
          url: globalLeaderWebhook.webhookUrl,
          threadId: (globalLeaderWebhook as any).threadId,
          name: "Global #leader-hq-alerts",
        });
      }

      // 2. Nếu không có Global, fallback sang Webhook các phòng ban
      if (targetWebhooks.length === 0) {
        const seenUrls = new Set<string>();
        for (const cfg of deptConfigs) {
          if (cfg.webhookUrl && !seenUrls.has(cfg.webhookUrl)) {
            seenUrls.add(cfg.webhookUrl);
            targetWebhooks.push({
              url: cfg.webhookUrl,
              threadId: cfg.threadId,
              name: cfg.department?.name,
            });
          }
        }
      }
    }

    // Bắn Embed + Components Link Buttons
    for (const target of targetWebhooks) {
      const sent = await discordWebhookService.notifyDailyStandupExecutiveSummary({
        targetWebhookUrl: target.url,
        targetThreadId: target.threadId,
        departmentId: params.departmentId,
        departmentName: target.name,
        summaryDateStr: todayStr,
        totalActiveInterns,
        submittedCount,
        approvedAbsences,
        blockedTasks,
        pendingExtensions,
      });
      if (sent) dispatchedWebhooksCount++;
    }

    // Ghi Audit Log hành động báo cáo Standup điều hành
    await this.repository.createAuditLog({
      action: AUDIT_ACTION.SEND_DAILY_STANDUP_EXECUTIVE_SUMMARY,
      targetType: AUDIT_TARGET_TYPE.CRON_JOB,
      targetId: CRON_JOB_NAMES.DAILY_STANDUP_EXECUTIVE_SUMMARY,
      details: {
        summaryDate: todayStr,
        totalActiveInterns,
        submittedCount,
        completionRate,
        approvedAbsencesCount: approvedAbsences.length,
        blockedTasksCount: blockedTasks.length,
        pendingExtensionsCount: pendingExtensions.length,
        dispatchedWebhooksCount,
      },
    });

    return {
      summaryDate: todayStr,
      totalActiveInterns,
      submittedCount,
      completionRate,
      approvedAbsencesCount: approvedAbsences.length,
      blockedTasksCount: blockedTasks.length,
      pendingExtensionsCount: pendingExtensions.length,
      dispatchedWebhooksCount,
    };
  }

  /**
   * 6. Quét lịch họp và gửi Embed nhắc nhở trước 15 phút qua Discord Webhook (#meeting-room)
   */
  async executeMeetingReminderJob(): Promise<{
    remindedMeetingsCount: number;
    meetings: string[];
  }> {
    const now = new Date();
    // Khung giờ quét từ 10 phút đến 20 phút tới (bình quân ~15 phút trước giờ bắt đầu)
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);

    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        status: MeetingStatus.SCHEDULED,
        deletedAt: null,
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        department: { select: { id: true, name: true } },
        host: { select: { fullName: true } },
      },
    });

    let remindedMeetingsCount = 0;
    const meetings: string[] = [];

    for (const meeting of upcomingMeetings) {
      // Kiểm tra tránh gửi trùng lặp nếu cron chạy lặp lại mỗi 5 phút
      const alreadyNotified = await prisma.auditLog.findFirst({
        where: {
          targetType: AUDIT_TARGET_TYPE.MEETING,
          targetId: meeting.id,
          action: AUDIT_ACTION.NOTIFY_DISCORD_REMINDER,
        },
      });

      if (alreadyNotified) {
        continue;
      }

      const sent = await discordWebhookService.notifyMeetingReminder({
        departmentId: meeting.departmentId,
        meeting: {
          id: meeting.id,
          title: meeting.title,
          departmentName: meeting.department?.name,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          meetingLink: meeting.meetingLink,
          location: meeting.location,
          hostName: meeting.host?.fullName,
        },
      });

      if (sent) {
        remindedMeetingsCount++;
        meetings.push(meeting.title);

        await prisma.auditLog.create({
          data: {
            action: AUDIT_ACTION.NOTIFY_DISCORD_REMINDER,
            targetType: AUDIT_TARGET_TYPE.MEETING,
            targetId: meeting.id,
            details: { meetingTitle: meeting.title, startTime: meeting.startTime },
          },
        });
      }
    }

    return { remindedMeetingsCount, meetings };
  }

  /**
   * 7. Bảng vàng vinh danh Top 3 Thực tập sinh điểm đánh giá tuần cao nhất (#vinh-danh)
   */
  async executeWeeklyLeaderboardJob(params: { week?: number; year?: number } = {}): Promise<{
    week: number;
    year: number;
    topCount: number;
    sent: boolean;
  }> {
    const now = new Date();
    // Tìm tuần đánh giá gần nhất nếu không truyền
    const latestEval = await prisma.weeklyEvaluation.findFirst({
      where: { deletedAt: null },
      orderBy: [{ year: "desc" }, { week: "desc" }],
      select: { week: true, year: true },
    });

    const targetWeek = params.week || latestEval?.week || 1;
    const targetYear = params.year || latestEval?.year || now.getFullYear();

    const evaluations = await prisma.weeklyEvaluation.findMany({
      where: {
        week: targetWeek,
        year: targetYear,
        deletedAt: null,
      },
      include: {
        intern: {
          select: {
            id: true,
            fullName: true,
            internCode: true,
            discordUsername: true,
            department: { select: { id: true, name: true } },
          },
        },
        targetUser: {
          select: {
            id: true,
            fullName: true,
            discordUsername: true,
            internshipProfile: {
              select: {
                internCode: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { score: "desc" },
      take: 3,
    });

    const topInterns = evaluations.map((ev, idx) => ({
      rank: idx + 1,
      fullName: ev.intern?.fullName || ev.targetUser?.fullName || "Thực tập sinh",
      internCode: ev.intern?.internCode || ev.targetUser?.internshipProfile?.internCode || null,
      departmentName: ev.intern?.department?.name || ev.targetUser?.internshipProfile?.department?.name,
      score: ev.score,
      strengths: ev.strengths,
      discordUsername: ev.intern?.discordUsername || ev.targetUser?.discordUsername || null,
    }));

    const sent = await discordWebhookService.notifyWeeklyLeaderboard({
      week: targetWeek,
      year: targetYear,
      topInterns,
    });

    return {
      week: targetWeek,
      year: targetYear,
      topCount: topInterns.length,
      sent,
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
        const phase = params["phase"] as "REMINDER" | "CLOSING" | undefined;
        executionData = await this.executeRemindDailyReports({ phase });
        break;
      }
      case CRON_JOB_NAMES.REMIND_DAILY_REPORT_FIRST: {
        executionData = await this.executeRemindDailyReports({ phase: "REMINDER" });
        break;
      }
      case CRON_JOB_NAMES.REMIND_DAILY_REPORT_CLOSING: {
        executionData = await this.executeRemindDailyReports({ phase: "CLOSING" });
        break;
      }
      case CRON_JOB_NAMES.DAILY_STANDUP_EXECUTIVE_SUMMARY: {
        const departmentId =
          typeof params["departmentId"] === "string"
            ? params["departmentId"]
            : undefined;
        executionData = await this.executeDailyStandupExecutiveSummary({
          departmentId,
        });
        break;
      }
      case CRON_JOB_NAMES.REMIND_UPCOMING_MEETINGS: {
        executionData = await this.executeMeetingReminderJob();
        break;
      }
      case CRON_JOB_NAMES.WEEKLY_LEADERBOARD_DISCORD: {
        const week = typeof params["week"] === "number" ? params["week"] : undefined;
        const year = typeof params["year"] === "number" ? params["year"] : undefined;
        executionData = await this.executeWeeklyLeaderboardJob({ week, year });
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
