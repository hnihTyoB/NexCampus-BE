import { prisma } from '../../database/prisma.client';
import {
  ListNotificationsDto,
  ListEmailsDto,
  ListNotificationTemplatesDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './notification.dto';

export class NotificationRepository {
  findMany(userId: string, dto: ListNotificationsDto) {
    const { page = 1, limit = 20, isRead, type } = dto;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(isRead !== undefined && { isRead }),
      ...(type && { type }),
    };

    return Promise.all([
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

  findActiveUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, deletedAt: null },
      select: { id: true, email: true },
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

  findEmails(dto: ListEmailsDto) {
    const { page = 1, limit = 20, status, toEmail } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(toEmail && { toEmail: { contains: toEmail, mode: 'insensitive' as const } }),
    };

    return Promise.all([
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

  findTemplates(dto: ListNotificationTemplatesDto) {
    const { page = 1, limit = 20, isActive, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return Promise.all([
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
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || 'SYSTEM',
        details: data.details || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}
