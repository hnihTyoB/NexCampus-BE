import { prisma } from '../../database/prisma.client';
import { NOTIFICATION_CHANNEL, NotificationChannel, EMAIL_STATUS, EmailTemplateKey } from '../constants/notification.constant';
import { mailConfig } from '../../config/mail.config';

export interface WebNotificationPayload {
  type: string;
  priority?: string;
  title: string;
  content: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailNotificationPayload {
  toEmail: string;
  templateKey: EmailTemplateKey;
  templateData: Record<string, unknown>;
}

export interface NotificationEvent {
  userId: string;
  channels: NotificationChannel[];
  web?: WebNotificationPayload;
  email?: EmailNotificationPayload;
}

class NotificationDispatcher {
  async send(event: NotificationEvent): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    if (event.channels.includes(NOTIFICATION_CHANNEL.WEB)) {
      if (!event.web) throw new Error('web payload is required for WEB channel');
      tasks.push(this.dispatchWeb(event.userId, event.web));
    }

    if (event.channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      if (!event.email) throw new Error('email payload is required for EMAIL channel');
      tasks.push(this.dispatchEmail(event.userId, event.email));
    }

    await Promise.all(tasks);
  }

  private async dispatchWeb(userId: string, payload: WebNotificationPayload): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        priority: payload.priority ?? 'NORMAL',
        title: payload.title,
        content: payload.content,
        actionUrl: payload.actionUrl,
        metadata: payload.metadata as any,
      },
    });
  }

  private async dispatchEmail(userId: string, payload: EmailNotificationPayload): Promise<void> {
    // Lấy subject từ templateKey để lưu vào DB (EmailWorker sẽ render HTML khi gửi)
    const subjectMap: Record<string, string> = {
      VERIFY_EMAIL: 'Xác thực tài khoản của bạn',
      RESET_PASSWORD: 'Đặt lại mật khẩu',
      NEW_DEVICE_ALERT: 'Phát hiện đăng nhập từ thiết bị mới',
      CUSTOM: (payload.templateData['subject'] as string) ?? 'Thông báo từ hệ thống',
    };

    await prisma.emailNotification.create({
      data: {
        userId,
        toEmail: payload.toEmail,
        subject: subjectMap[payload.templateKey] ?? 'Thông báo',
        templateKey: payload.templateKey,
        templateData: payload.templateData as any,
        status: EMAIL_STATUS.PENDING,
      },
    });
  }

  /**
   * Tạo Web Notification nhanh — shorthand không cần EMAIL channel.
   */
  async notify(
    userId: string,
    type: string,
    title: string,
    content: string,
    options?: { priority?: string; actionUrl?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await this.dispatchWeb(userId, { type, title, content, ...options });
  }
}

export const notificationDispatcher = new NotificationDispatcher();
