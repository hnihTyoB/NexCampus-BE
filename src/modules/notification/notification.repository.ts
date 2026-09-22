import { prisma } from "../../database/prisma.client";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
  SYSTEM_TARGET_ID,
} from "../../common/constants/audit-log.constant";
import { VIETNAM_OFFSET_MS } from "../../common/constants/date.constant";
import {
  getVietnamToday,
  getVietnamWeekRange,
} from "../../common/helpers/date.helper";
import { activityLogRepository } from "../activity-logs/activity-log.repository";
import { EMAIL_MAX_ATTEMPTS } from "../../common/constants/notification.constant";
import {
  ListNotificationsDto,
  ListEmailsDto,
  ListNotificationTemplatesDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from "./notification.dto";

export interface ClaimedEmailRecord {
  id: string;
  userId: string | null;
  toEmail: string;
  subject: string;
  templateKey: string;
  templateData: unknown;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationRepository {
  async findMany(userId: string, dto: ListNotificationsDto) {
    const { page = 1, limit = 20, isRead, type } = dto;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(isRead !== undefined && { isRead }),
      ...(type && { type }),
    };

    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          priority: true,
          title: true,
          content: true,
          actionUrl: true,
          metadata: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
    ]);
  }

  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  findOne(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId } });
  }

  markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  delete(id: string, userId: string) {
    return prisma.notification.deleteMany({ where: { id, userId } });
  }

  clearRead(userId: string) {
    return prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });
  }

  getAllActiveUsers() {
    return prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, email: true },
    });
  }

  getActiveUsersChunk(take = 500, cursorId?: string) {
    return prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
      take,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
    });
  }

  findActiveUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, deletedAt: null },
      select: { id: true, email: true },
    });
  }

  findUserEmailById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
  }

  createSingleNotification(data: {
    userId: string;
    type: string;
    priority?: string;
    title: string;
    content: string;
    actionUrl?: string | null;
    metadata?: any;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        priority: data.priority ?? "NORMAL",
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata ?? null,
      },
    });
  }

  createSingleEmailNotification(data: {
    userId?: string | null;
    toEmail: string;
    subject: string;
    templateKey: string;
    templateData: any;
    status?: string;
  }) {
    const validUserId =
      data.userId && /^[0-9a-fA-F-]{36}$/.test(data.userId)
        ? data.userId
        : null;
    return prisma.emailNotification.create({
      data: {
        userId: validUserId,
        toEmail: data.toEmail,
        subject: data.subject,
        templateKey: data.templateKey,
        templateData: data.templateData,
        status: data.status ?? "PENDING",
      },
    });
  }

  createManyNotifications(
    data: Array<{
      userId: string;
      type: string;
      priority: string;
      title: string;
      content: string;
      actionUrl?: string | null;
      metadata?: any;
    }>,
  ) {
    return prisma.notification.createMany({ data });
  }

  createManyEmailNotifications(
    data: Array<{
      userId?: string | null;
      toEmail: string;
      subject: string;
      templateKey: string;
      templateData: any;
      status: string;
    }>,
  ) {
    const formattedData = data.map((d) => ({
      ...d,
      userId: d.userId && /^[0-9a-fA-F-]{36}$/.test(d.userId) ? d.userId : null,
    }));
    return prisma.emailNotification.createMany({ data: formattedData });
  }

  createMultiChannelNotifications(
    webData: Array<{
      userId: string;
      type: string;
      priority: string;
      title: string;
      content: string;
      actionUrl?: string | null;
      metadata?: any;
    }>,
    emailData: Array<{
      userId?: string | null;
      toEmail: string;
      subject: string;
      templateKey: string;
      templateData: any;
      status: string;
    }>,
  ) {
    const formattedEmailData = emailData.map((d) => ({
      ...d,
      userId: d.userId && /^[0-9a-fA-F-]{36}$/.test(d.userId) ? d.userId : null,
    }));
    return prisma.$transaction(async (tx) => {
      if (webData.length > 0) {
        await tx.notification.createMany({ data: webData });
      }
      if (formattedEmailData.length > 0) {
        await tx.emailNotification.createMany({ data: formattedEmailData });
      }
    });
  }

  async claimPendingEmails(batchSize = 20): Promise<ClaimedEmailRecord[]> {
    return prisma.$queryRaw<ClaimedEmailRecord[]>`
      UPDATE email_notifications
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM email_notifications
        WHERE (
          status = 'PENDING'
          OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '15 minutes')
        )
        AND attempts < ${EMAIL_MAX_ATTEMPTS}
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        user_id AS "userId",
        to_email AS "toEmail",
        subject,
        template_key AS "templateKey",
        template_data AS "templateData",
        status,
        attempts,
        last_error AS "lastError",
        sent_at AS "sentAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
  }

  updateEmailStatus(
    id: string,
    data: {
      status: string;
      attempts?: number;
      lastError?: string | null;
      sentAt?: Date | null;
    },
  ) {
    return prisma.emailNotification.update({
      where: { id },
      data,
    });
  }

  async findEmails(dto: ListEmailsDto) {
    const { page = 1, limit = 20, status, toEmail } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(toEmail && {
        toEmail: { contains: toEmail, mode: "insensitive" as const },
      }),
    };

    return prisma.$transaction([
      prisma.emailNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.emailNotification.count({ where }),
    ]);
  }

  findEmailById(id: string) {
    return prisma.emailNotification.findUnique({ where: { id } });
  }

  resetEmailForRetry(id: string) {
    return prisma.emailNotification.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
      },
    });
  }

  // ─────────────────────────────────────────────
  // Template Repository Methods
  // ─────────────────────────────────────────────

  async findTemplates(dto: ListNotificationTemplatesDto) {
    const { page = 1, limit = 20, isActive, search, channel } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(isActive !== undefined && { isActive }),
      ...(channel && { channels: { array_contains: channel } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.$transaction([
      prisma.notificationTemplate.findMany({
        where,
        orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.notificationTemplate.count({ where }),
    ]);
  }

  findTemplateByCode(code: string) {
    return prisma.notificationTemplate.findUnique({ where: { code } });
  }

  findTemplateById(id: string) {
    return prisma.notificationTemplate.findUnique({ where: { id } });
  }

  createTemplate(data: CreateNotificationTemplateDto) {
    return prisma.notificationTemplate.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        channels: data.channels as any,
        subject: data.subject,
        title: data.title,
        content: data.content,
        variables: data.variables as any,
        isSystem: false,
        isActive: data.isActive ?? true,
      },
    });
  }

  updateTemplate(id: string, data: UpdateNotificationTemplateDto) {
    return prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.channels !== undefined && { channels: data.channels as any }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.variables !== undefined && {
          variables: data.variables as any,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  deleteTemplate(id: string) {
    return prisma.notificationTemplate.delete({ where: { id } });
  }

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return activityLogRepository.create(data);
  }

  // ─────────────────────────────────────────────
  // Action Counts (Action-Required Badge)
  // ─────────────────────────────────────────────

  async countActionItems(userId: string, roleName: string) {
    const now = new Date();

    if (roleName === "INTERN") {
      // Lấy intern profile từ userId
      const intern = await prisma.intern.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true, startDate: true },
      });
      if (!intern) return {};

      // Ngày hôm nay theo lịch Việt Nam (UTC 00:00:00 tương ứng ngày VN)
      const today = getVietnamToday();
      const nowVn = new Date(now.getTime() + VIETNAM_OFFSET_MS);
      const dayOfWeek = nowVn.getUTCDay(); // 0 = Chủ Nhật, 1 = T2, ..., 5 = T6, 6 = T7
      const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const hasStarted = new Date(intern.startDate).getTime() <= today.getTime();

      const [
        pendingTasks,
        todayReportCount,
        unviewedEvaluations,
        pendingMeetingRsvp,
      ] = await prisma.$transaction([
        // Tasks đang hoạt động (chưa DONE)
        prisma.taskAssignment.count({
          where: {
            internId: intern.id,
            status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW"] },
          },
        }),
        // Báo cáo ngày hôm nay (nếu là ngày làm việc T2–T6 và đã bắt đầu)
        isWorkday && hasStarted
          ? prisma.dailyReport.count({
              where: {
                internId: intern.id,
                date: today,
                deletedAt: null,
              },
            })
          : prisma.dailyReport.count({
              where: { id: "00000000-0000-0000-0000-000000000000" },
            }),
        // Đánh giá tuần chưa xem
        prisma.weeklyEvaluation.count({
          where: {
            internId: intern.id,
            viewedAt: null,
            deletedAt: null,
          },
        }),
        // Lời mời họp chưa xác nhận
        prisma.meetingParticipant.count({
          where: {
            userId,
            invitationStatus: "PENDING",
            meeting: { deletedAt: null },
          },
        }),
      ]);

      // Do intern không thể đánh giá/nộp ngày đã qua nên badge CHỈ báo cho ngày hôm nay
      const missedReports =
        isWorkday && hasStarted && todayReportCount === 0 ? 1 : 0;

      return {
        pendingTasks,
        missedReports,
        unviewedEvaluations,
        pendingMeetingRsvp,
      };
    }

    if (roleName === "LEADER") {
      // Tuần hiện tại theo giờ Việt Nam
      const { startOfWeek, endOfWeek } = getVietnamWeekRange(now);
      // Hết ngày Thứ Hai của tuần hiện tại (23:59:59.999 VN)
      const endOfMonday = new Date(startOfWeek.getTime() + 24 * 3600 * 1000 - 1);

      // 1. Lấy danh sách intern ACTIVE dưới quyền leader
      const activeInterns = await prisma.intern.findMany({
        where: {
          leaderId: userId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: {
          id: true,
          startDate: true,
          createdAt: true,
        },
      });

      // 2. Kiểm tra log phân công leader giữa tuần (sau Thứ Hai tuần này)
      const internIds = activeInterns.map((i) => i.id);
      const midWeekAssignedIds = new Set<string>();

      if (internIds.length > 0) {
        const assignmentLogs = await prisma.auditLog.findMany({
          where: {
            action: AUDIT_ACTION.ASSIGN_LEADER,
            targetType: AUDIT_TARGET_TYPE.INTERN,
            targetId: { in: internIds },
            createdAt: { gt: endOfMonday, lte: endOfWeek },
          },
          select: {
            targetId: true,
            details: true,
          },
        });

        for (const log of assignmentLogs) {
          const details = log.details as { leaderId?: string } | null;
          if (details?.leaderId === userId) {
            midWeekAssignedIds.add(log.targetId);
          }
        }
      }

      // 3. Loại bỏ intern vừa được giao giữa tuần khỏi WeeklyEvaluation:
      // Không tính intern bắt đầu sau T2, tạo sau T2, hoặc được gán cho leader sau T2 tuần này
      const eligibleInterns = activeInterns.filter((intern) => {
        if (intern.startDate > endOfMonday) return false;
        if (intern.createdAt > endOfMonday) return false;
        if (midWeekAssignedIds.has(intern.id)) return false;
        return true;
      });

      const eligibleInternIds = eligibleInterns.map((i) => i.id);

      const [
        pendingSubmissions,
        unreviewedReports,
        evaluationsThisWeek,
        pendingMeetingRsvp,
      ] = await prisma.$transaction([
        // Bài nộp chờ duyệt từ các intern dưới quyền
        prisma.taskSubmission.count({
          where: {
            reviewStatus: "PENDING",
            assignment: {
              intern: { leaderId: userId, deletedAt: null },
            },
          },
        }),
        // Báo cáo ngày chưa có feedback từ các intern dưới quyền
        prisma.dailyReport.count({
          where: {
            feedbackBy: null,
            deletedAt: null,
            intern: { leaderId: userId, deletedAt: null },
          },
        }),
        // Đánh giá tuần đã làm trong tuần này cho các intern đủ điều kiện
        eligibleInternIds.length > 0
          ? prisma.weeklyEvaluation.findMany({
              where: {
                internId: { in: eligibleInternIds },
                deletedAt: null,
                OR: [
                  { createdAt: { gte: startOfWeek, lte: endOfWeek } },
                  { startDate: { gte: startOfWeek, lte: endOfWeek } },
                ],
              },
              select: { internId: true },
            })
          : prisma.weeklyEvaluation.findMany({
              where: { id: "00000000-0000-0000-0000-000000000000" },
              select: { internId: true },
            }),
        // Lời mời họp chưa xác nhận
        prisma.meetingParticipant.count({
          where: {
            userId,
            invitationStatus: "PENDING",
            meeting: { deletedAt: null },
          },
        }),
      ]);

      const evaluatedSet = new Set(evaluationsThisWeek.map((e) => e.internId));
      const pendingEvaluations = eligibleInterns.filter(
        (i) => !evaluatedSet.has(i.id),
      ).length;

      return {
        pendingSubmissions,
        unreviewedReports,
        pendingEvaluations,
        pendingMeetingRsvp,
      };
    }

    // Admin và các role khác
    const [pendingApplications, pendingMeetingRsvp] = await prisma.$transaction(
      [
        prisma.application.count({
          where: { status: "PENDING", deletedAt: null },
        }),
        prisma.meetingParticipant.count({
          where: {
            userId,
            invitationStatus: "PENDING",
            meeting: { deletedAt: null },
          },
        }),
      ],
    );

    return { pendingApplications, pendingMeetingRsvp };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Đếm số ngày làm việc (T2–T6) trong khoảng [start, end] */
function countWorkdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cur <= endDay) {
    const day = cur.getDay(); // 0=CN, 6=T7
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Lấy ISO week number và năm */
function getIsoWeekAndYear(date: Date): { isoWeek: number; isoYear: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Đặt về thứ Năm trong tuần ISO (để xác định năm)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const isoWeek =
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86400000 -
        3 +
        ((jan4.getDay() + 6) % 7)) /
        7,
    );
  return { isoWeek, isoYear: d.getFullYear() };
}

export const notificationRepository = new NotificationRepository();
