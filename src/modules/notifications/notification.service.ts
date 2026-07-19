import { NotificationRepository } from "./notification.repository";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  NotificationQueryDto,
  CreateNotificationDto,
} from "./notification.dto";
import { ROLES } from "../../common/constants/role.constant";
import { NOTIFICATION_EVENT } from "../../common/constants/notification-event.constant";
import { emitNotificationToUser, emitNotificationEventToUser } from "../../lib/sse";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class NotificationService {
  private readonly repository = new NotificationRepository();

  async findAll(query: NotificationQueryDto, user: UserPayload) {
    // Nếu là INTERN: Bắt buộc chỉ được xem thông báo của chính mình
    // Nếu là ADMIN/LEADER: Mặc định xem thông báo của chính mình, trừ khi truyền query.userId cụ thể
    const userIdFilter = user.role === ROLES.INTERN
      ? user.id
      : (query.userId || user.id);
    return this.repository.findAll(query, userIdFilter);
  }

  async findById(id: string, user: UserPayload) {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new AppError("Notification not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.role === ROLES.INTERN && notification.userId !== user.id) {
      throw new AppError(
        "You are not authorized to view this notification",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    return notification;
  }

  async create(data: CreateNotificationDto) {
    const recipient = await prisma.user.findFirst({
      where: { id: data.userId, deletedAt: null },
    });

    if (!recipient) {
      throw new AppError("Recipient user not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const created = await this.repository.create(data);
    emitNotificationToUser(data.userId, created);
    return created;
  }

  async markAsRead(id: string, user: UserPayload) {
    const notification = await this.findById(id, user);

    if (notification.isRead) {
      return notification;
    }

    return this.repository.markAsRead(id);
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    emitNotificationEventToUser(userId, { type: NOTIFICATION_EVENT.READ_ALL });
    return result;
  }

  async countUnread(userId: string) {
    return this.repository.countUnread(userId);
  }

  async deleteReadNotifications(userId: string) {
    const result = await this.repository.deleteReadNotifications(userId);
    emitNotificationEventToUser(userId, { type: NOTIFICATION_EVENT.CLEARED_READ });
    return result;
  }

  async delete(id: string, user: UserPayload) {
    const notification = await this.findById(id, user);
    const result = await this.repository.delete(id);
    emitNotificationEventToUser(notification.userId, {
      type: NOTIFICATION_EVENT.DELETED,
      payload: { id },
    });
    return result;
  }

  async sendCustom(data: {
    email: string;
    title: string;
    content: string;
    emailSubject?: string;
    emailContent?: string;
    sendWeb?: boolean;
    sendEmail?: boolean;
    params?: Record<string, unknown>;
  }) {
    const interpolate = (tpl: string, p?: Record<string, unknown>) => {
      if (!p) return tpl;
      return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        p[key] !== undefined ? String(p[key]) : `{{${key}}}`,
      );
    };

    const finalTitle = interpolate(data.title, data.params);
    const finalContent = interpolate(data.content, data.params);
    const finalSubject = interpolate(data.emailSubject || data.title, data.params);
    const finalBody = interpolate(data.emailContent || data.content, data.params);

    const recipient = await prisma.user.findFirst({
      where: { email: data.email.toLowerCase().trim(), deletedAt: null },
    });

    if (data.sendWeb !== false && !recipient) {
      throw new AppError(
        "A registered user account is required to send Web notifications.",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const crypto = await import("crypto");
    let notificationId: string = crypto.randomUUID();
    let notification = null;

    if (data.sendWeb !== false && recipient) {
      notification = await prisma.notification.create({
        data: {
          userId: recipient.id,
          title: finalTitle,
          content: finalContent,
          type: "CUSTOM",
          isRead: false,
        },
      });
      notificationId = notification.id;

      emitNotificationToUser(recipient.id, notification);

      await prisma.notificationLog.create({
        data: {
          notificationId,
          channel: "WEB",
          status: "SUCCESS",
        },
      });
    }

    if (data.sendEmail !== false) {
      const { notificationQueue } = await import("../../queues/notification.queue");
      await notificationQueue.add(`notify-custom-${notificationId}`, {
        notificationId,
        userId: recipient?.id,
        guestEmail: !recipient ? data.email.toLowerCase().trim() : undefined,
        title: finalTitle,
        content: finalContent,
        emailEnabled: true,
        discordEnabled: false,
        emailSubject: finalSubject,
        emailContent: finalBody,
      });
    }

    return { success: true, notification };
  }
}
