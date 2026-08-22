import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import {
  ListNotificationsDto,
  ListNotificationsResponseDto,
  UnreadCountResponseDto,
  SendNotificationDto,
  BroadcastNotificationDto,
  ListEmailsDto,
  ListEmailsResponseDto,
} from './notification.dto';
import { NotificationRepository } from './notification.repository';
import { notificationDispatcher } from '../../common/services/notification-dispatcher.service';
import { NOTIFICATION_CHANNEL, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY, EMAIL_TEMPLATE_KEY } from '../../common/constants/notification.constant';

export class NotificationService {
  private readonly repository = new NotificationRepository();

  async list(userId: string, dto: ListNotificationsDto): Promise<ListNotificationsResponseDto> {
    const { page = 1, limit = 20 } = dto;
    const [items, total] = await this.repository.findMany(userId, dto);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.repository.countUnread(userId);
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.repository.findOne(notificationId, userId);
    if (!notification) {
      throw new AppError('Notification not found', 404, ERROR_CODE.NOT_FOUND);
    }
    await this.repository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    const notification = await this.repository.findOne(notificationId, userId);
    if (!notification) {
      throw new AppError('Notification not found', 404, ERROR_CODE.NOT_FOUND);
    }
    await this.repository.delete(notificationId, userId);
  }

  async send(dto: SendNotificationDto): Promise<{ sentCount: number }> {
    const { userIds, channels, title, content, type = NOTIFICATION_TYPE.SYSTEM, priority = NOTIFICATION_PRIORITY.NORMAL, actionUrl, metadata, templateKey = EMAIL_TEMPLATE_KEY.CUSTOM, templateData } = dto;

    if (channels.includes(NOTIFICATION_CHANNEL.WEB)) {
      const records = userIds.map((userId) => ({
        userId,
        type,
        priority,
        title,
        content,
        actionUrl: actionUrl || null,
        metadata: metadata || null,
      }));
      await this.repository.createManyNotifications(records);
    }

    if (channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      const targetUsers = await this.repository.findActiveUsersByIds(userIds);

      const subjectMap: Record<string, string> = {
        VERIFY_EMAIL: 'Xác thực tài khoản của bạn',
        RESET_PASSWORD: 'Đặt lại mật khẩu',
        NEW_DEVICE_ALERT: 'Phát hiện đăng nhập từ thiết bị mới',
        CUSTOM: ((templateData?.subject as string) || title) ?? 'Thông báo từ hệ thống',
      };

      const emailRecords = targetUsers.map((u) => ({
        userId: u.id,
        toEmail: u.email!,
        subject: subjectMap[templateKey] ?? title,
        templateKey,
        templateData: (templateData || { subject: title, html: content }) as any,
        status: 'PENDING',
      }));

      if (emailRecords.length > 0) {
        await this.repository.createManyEmailNotifications(emailRecords);
      }
    }

    return { sentCount: userIds.length };
  }

  async broadcast(dto: BroadcastNotificationDto): Promise<{ totalRecipients: number }> {
    const activeUsers = await this.repository.getAllActiveUsers();
    if (activeUsers.length === 0) {
      return { totalRecipients: 0 };
    }

    const records = activeUsers.map((u) => ({
      userId: u.id,
      type: dto.type || NOTIFICATION_TYPE.SYSTEM,
      priority: dto.priority || NOTIFICATION_PRIORITY.NORMAL,
      title: dto.title,
      content: dto.content,
      actionUrl: dto.actionUrl || null,
      metadata: dto.metadata || null,
    }));

    await this.repository.createManyNotifications(records);

    return { totalRecipients: activeUsers.length };
  }

  async listEmails(dto: ListEmailsDto): Promise<ListEmailsResponseDto> {
    const { page = 1, limit = 20 } = dto;
    const [items, total] = await this.repository.findEmails(dto);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async retryEmail(emailId: string): Promise<void> {
    const email = await this.repository.findEmailById(emailId);
    if (!email) {
      throw new AppError('Email record not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (email.status === 'SENT') {
      throw new AppError('Email has already been sent successfully', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    await this.repository.resetEmailForRetry(emailId);
  }
}
