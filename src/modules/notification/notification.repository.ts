import { prisma } from '../../database/prisma.client';
import { ListNotificationsDto, ListEmailsDto } from './notification.dto';

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
}
