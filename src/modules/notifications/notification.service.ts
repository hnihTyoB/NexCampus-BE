import { NotificationRepository } from "./notification.repository";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  NotificationQueryDto,
  CreateNotificationDto,
} from "./notification.dto";
import { ROLES } from "../../common/constants/role.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class NotificationService {
  private readonly repository = new NotificationRepository();

  async findAll(query: NotificationQueryDto, user: UserPayload) {
    const userIdFilter = user.role === ROLES.INTERN ? user.id : undefined;
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

    return this.repository.create(data);
  }

  async markAsRead(id: string, user: UserPayload) {
    const notification = await this.findById(id, user);

    if (notification.isRead) {
      return notification;
    }

    return this.repository.markAsRead(id);
  }

  async delete(id: string, user: UserPayload) {
    await this.findById(id, user);

    return this.repository.delete(id);
  }

  async sendCustom(data: {
    email: string;
    title: string;
    content: string;
    emailSubject?: string;
    emailContent?: string;
    sendWeb?: boolean;
    sendEmail?: boolean;
  }) {
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
          title: data.title,
          content: data.content,
          type: "CUSTOM",
          isRead: false,
        },
      });
      notificationId = notification.id;

      await prisma.notificationLog.create({
        data: {
          notificationId,
          channel: "WEB",
          status: "SUCCESS",
        },
      });
    }

    if (data.sendEmail !== false) {
      if (recipient) {
        // Registered user: queue the email job normally
        const { notificationQueue } = await import("../../queues/notification.queue");
        await notificationQueue.add(`notify-custom-${notificationId}`, {
          notificationId,
          userId: recipient.id,
          title: data.title,
          content: data.content,
          emailEnabled: true,
          discordEnabled: false,
          emailSubject: data.emailSubject || data.title,
          emailContent: data.emailContent || data.content,
        });
      } else {
        // Guest or onboarding candidate: dispatch directly using EmailService
        const { EmailService } = await import("../../common/services/email.service");
        await EmailService.sendMail(
          data.email.toLowerCase().trim(),
          data.emailSubject || data.title,
          data.emailContent || data.content
        );
      }
    }

    return { success: true, notification };
  }
}
