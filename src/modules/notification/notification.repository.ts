import { prisma } from '../../database/prisma.client';
import { SYSTEM_TARGET_ID } from '../../common/constants/audit-log.constant';
import { EMAIL_MAX_ATTEMPTS } from '../../common/constants/notification.constant';
import {
  ListNotificationsDto,
  ListEmailsDto,
  ListNotificationTemplatesDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './notification.dto';

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
        orderBy: { createdAt: 'desc' },
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
      orderBy: { id: 'asc' },
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
        priority: data.priority ?? 'NORMAL',
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata ?? null,
      },
    });
  }

  createSingleEmailNotification(data: {
    userId: string;
    toEmail: string;
    subject: string;
    templateKey: string;
    templateData: any;
    status?: string;
  }) {
    return prisma.emailNotification.create({
      data: {
        userId: data.userId,
        toEmail: data.toEmail,
        subject: data.subject,
        templateKey: data.templateKey,
        templateData: data.templateData,
        status: data.status ?? 'PENDING',
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
      userId: string;
      toEmail: string;
      subject: string;
      templateKey: string;
      templateData: any;
      status: string;
    }>,
  ) {
    return prisma.emailNotification.createMany({ data });
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
      userId: string;
      toEmail: string;
      subject: string;
      templateKey: string;
      templateData: any;
      status: string;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      if (webData.length > 0) {
        await tx.notification.createMany({ data: webData });
      }
      if (emailData.length > 0) {
        await tx.emailNotification.createMany({ data: emailData });
      }
    });
  }

  async claimPendingEmails(batchSize = 20): Promise<ClaimedEmailRecord[]> {
    return prisma.$queryRaw<ClaimedEmailRecord[]>`
      UPDATE email_notifications
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM email_notifications
        WHERE status = 'PENDING' AND attempts < ${EMAIL_MAX_ATTEMPTS}
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
      ...(toEmail && { toEmail: { contains: toEmail, mode: 'insensitive' as const } }),
    };

    return prisma.$transaction([
      prisma.emailNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
        status: 'PENDING',
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
      ...(channel && { channels: { array_contains: [channel] } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return prisma.$transaction([
      prisma.notificationTemplate.findMany({
        where,
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'desc' }],
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
        ...(data.description !== undefined && { description: data.description }),
        ...(data.channels !== undefined && { channels: data.channels as any }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.variables !== undefined && { variables: data.variables as any }),
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
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || SYSTEM_TARGET_ID,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const notificationRepository = new NotificationRepository();

