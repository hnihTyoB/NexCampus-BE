import {
  NOTIFICATION_CHANNEL,
  NotificationChannel,
  EMAIL_STATUS,
  EmailTemplateKey,
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
  DEFAULT_EMAIL_SUBJECTS,
} from '../constants/notification.constant';
import { renderTemplateString } from '../helpers/template.helper';
import { notificationRepository } from '../../modules/notification/notification.repository';

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
  templateKey: EmailTemplateKey | string;
  templateData: Record<string, unknown>;
  subject?: string;
}

export interface NotificationEvent {
  userId: string;
  channels: NotificationChannel[];
  web?: WebNotificationPayload;
  email?: EmailNotificationPayload;
}

export interface SendWithTemplateOptions {
  userId: string;
  templateCode: string;
  variables: Record<string, unknown>;
  channels?: NotificationChannel[];
  toEmail?: string;
  actionUrl?: string;
  priority?: string;
  type?: string;
  metadata?: Record<string, unknown>;
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

  /**
   * Phân phối thông báo sử dụng mẫu Database-driven Template (NotificationTemplate).
   * Tự động thay thế các biến {{variableName}} vào title/content cho WEB và subject/content cho EMAIL.
   */
  async sendWithTemplate(options: SendWithTemplateOptions): Promise<void> {
    const { userId, templateCode, variables, toEmail, actionUrl, metadata } = options;

    const template = await notificationRepository.findTemplateByCode(templateCode);

    if (!template || !template.isActive) {
      console.warn(`[NotificationDispatcher] Template '${templateCode}' not found or inactive.`);
      return;
    }

    const templateChannels = (template.channels as string[]) || [];
    const targetChannels = options.channels || (templateChannels as NotificationChannel[]);

    const tasks: Promise<unknown>[] = [];

    if (targetChannels.includes(NOTIFICATION_CHANNEL.WEB)) {
      const title = renderTemplateString(template.title || template.name, variables);
      const content = renderTemplateString(template.content, variables);
      tasks.push(
        this.dispatchWeb(userId, {
          type: options.type || NOTIFICATION_TYPE.INFO,
          priority: options.priority || NOTIFICATION_PRIORITY.NORMAL,
          title,
          content,
          actionUrl,
          metadata,
        }),
      );
    }

    if (targetChannels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      let emailAddress = toEmail;
      if (!emailAddress) {
        const user = await notificationRepository.findUserEmailById(userId);
        emailAddress = user?.email || undefined;
      }

      if (emailAddress) {
        const subject = renderTemplateString(template.subject || template.name, variables);
        tasks.push(
          this.dispatchEmail(userId, {
            toEmail: emailAddress,
            templateKey: template.code,
            templateData: variables,
            subject,
          }),
        );
      }
    }

    await Promise.all(tasks);
  }

  private async dispatchWeb(userId: string, payload: WebNotificationPayload): Promise<void> {
    await notificationRepository.createSingleNotification({
      userId,
      type: payload.type,
      priority: payload.priority,
      title: payload.title,
      content: payload.content,
      actionUrl: payload.actionUrl,
      metadata: payload.metadata,
    });
  }

  private async dispatchEmail(userId: string, payload: EmailNotificationPayload): Promise<void> {
    const subject =
      payload.subject ||
      (payload.templateData['subject'] as string) ||
      DEFAULT_EMAIL_SUBJECTS[payload.templateKey] ||
      'Thông báo từ hệ thống';

    await notificationRepository.createSingleEmailNotification({
      userId,
      toEmail: payload.toEmail,
      subject,
      templateKey: payload.templateKey,
      templateData: payload.templateData,
      status: EMAIL_STATUS.PENDING,
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

