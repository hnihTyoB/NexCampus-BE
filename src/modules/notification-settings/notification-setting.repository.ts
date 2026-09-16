import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { UpdateNotificationSettingDto } from "./notification-setting.dto";

export class NotificationSettingRepository {
  async findByUserId(userId: string) {
    return prisma.notificationSetting.findUnique({
      where: { userId },
    });
  }

  async findOrCreateDefault(userId: string) {
    return prisma.notificationSetting.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        webEnabled: true,
        taskAssignedEmail: true,
        taskAssignedInApp: true,
        submissionReviewedEmail: true,
        submissionReviewedInApp: true,
        dailyReportReminderEmail: true,
        dailyReportReminderInApp: true,
        meetingScheduleEmail: true,
        meetingScheduleInApp: true,
      },
    });
  }

  async update(userId: string, data: UpdateNotificationSettingDto) {
    // If webEnabled is updated, sync inAppEnabled and vice versa for backward compatibility
    const webEnabled = data.webEnabled ?? data.inAppEnabled;
    const inAppEnabled = data.inAppEnabled ?? data.webEnabled;

    return prisma.notificationSetting.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: data.emailEnabled ?? true,
        inAppEnabled: inAppEnabled ?? true,
        webEnabled: webEnabled ?? true,
        taskAssignedEmail: data.taskAssignedEmail ?? true,
        taskAssignedInApp: data.taskAssignedInApp ?? true,
        submissionReviewedEmail: data.submissionReviewedEmail ?? true,
        submissionReviewedInApp: data.submissionReviewedInApp ?? true,
        dailyReportReminderEmail: data.dailyReportReminderEmail ?? true,
        dailyReportReminderInApp: data.dailyReportReminderInApp ?? true,
        meetingScheduleEmail: data.meetingScheduleEmail ?? true,
        meetingScheduleInApp: data.meetingScheduleInApp ?? true,
      },
      update: {
        ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
        ...(inAppEnabled !== undefined && { inAppEnabled, webEnabled: inAppEnabled }),
        ...(data.taskAssignedEmail !== undefined && { taskAssignedEmail: data.taskAssignedEmail }),
        ...(data.taskAssignedInApp !== undefined && { taskAssignedInApp: data.taskAssignedInApp }),
        ...(data.submissionReviewedEmail !== undefined && { submissionReviewedEmail: data.submissionReviewedEmail }),
        ...(data.submissionReviewedInApp !== undefined && { submissionReviewedInApp: data.submissionReviewedInApp }),
        ...(data.dailyReportReminderEmail !== undefined && { dailyReportReminderEmail: data.dailyReportReminderEmail }),
        ...(data.dailyReportReminderInApp !== undefined && { dailyReportReminderInApp: data.dailyReportReminderInApp }),
        ...(data.meetingScheduleEmail !== undefined && { meetingScheduleEmail: data.meetingScheduleEmail }),
        ...(data.meetingScheduleInApp !== undefined && { meetingScheduleInApp: data.meetingScheduleInApp }),
      },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || "SYSTEM",
        details: data.details as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  }
}
