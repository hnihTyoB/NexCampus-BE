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
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  ListNotificationTemplatesDto,
  ListNotificationTemplatesResponseDto,
  PreviewNotificationTemplateDto,
  PreviewNotificationTemplateResponseDto,
  TestSendNotificationTemplateDto,
} from './notification.dto';
import { NotificationRepository } from './notification.repository';
import { notificationDispatcher } from '../../common/services/notification-dispatcher.service';
import { EmailTemplateService } from '../../common/services/email-template.service';
import { renderTemplateString } from '../../common/helpers/template.helper';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
  EMAIL_TEMPLATE_KEY,
  NotificationChannel,
  DEFAULT_EMAIL_SUBJECTS,
} from '../../common/constants/notification.constant';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { sseManagerService } from '../../common/services/sse-manager.service';

export class NotificationService {
  private readonly repository = new NotificationRepository();
  private readonly emailTemplateService = new EmailTemplateService();

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
    sseManagerService.sendToUser(userId, {
      type: 'notification:read',
      data: { notificationId },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
    sseManagerService.sendToUser(userId, {
      type: 'notification:read_all',
      data: {},
    });
  }


  async delete(userId: string, notificationId: string): Promise<void> {
    const notification = await this.repository.findOne(notificationId, userId);
    if (!notification) {
      throw new AppError('Notification not found', 404, ERROR_CODE.NOT_FOUND);
    }
    await this.repository.delete(notificationId, userId);
  }

  async send(dto: SendNotificationDto): Promise<{ sentCount: number }> {
    const { userIds, channels, title, content, type, priority, actionUrl, metadata, templateKey = EMAIL_TEMPLATE_KEY.CUSTOM, templateData } = dto;

    const webRecords = channels.includes(NOTIFICATION_CHANNEL.WEB)
      ? userIds.map((userId) => ({
          userId,
          type: type || NOTIFICATION_TYPE.INFO,
          priority: priority || NOTIFICATION_PRIORITY.NORMAL,
          title,
          content,
          actionUrl: actionUrl || null,
          metadata: metadata || null,
        }))
      : [];

    let emailRecords: Array<{
      userId: string;
      toEmail: string;
      subject: string;
      templateKey: string;
      templateData: any;
      status: string;
    }> = [];

    if (channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      const targetUsers = await this.repository.findActiveUsersByIds(userIds);
      const subject = ((templateData?.subject as string) || DEFAULT_EMAIL_SUBJECTS[templateKey] || title) ?? 'Thông báo từ hệ thống';

      emailRecords = targetUsers.map((u) => ({
        userId: u.id,
        toEmail: u.email!,
        subject,
        templateKey,
        templateData: (templateData || { subject: title, html: content }) as any,
        status: 'PENDING',
      }));
    }

    if (webRecords.length > 0 || emailRecords.length > 0) {
      await this.repository.createMultiChannelNotifications(webRecords, emailRecords);

      // Real-time Push via SSE cho các user nhận kênh WEB
      if (channels.includes(NOTIFICATION_CHANNEL.WEB)) {
        for (const userId of userIds) {
          sseManagerService.sendToUser(userId, {
            type: 'notification:new',
            data: {
              title,
              content,
              type: type || NOTIFICATION_TYPE.INFO,
              priority: priority || NOTIFICATION_PRIORITY.NORMAL,
              actionUrl: actionUrl || null,
              createdAt: new Date().toISOString(),
            },
          });
        }
      }
    }

    return { sentCount: userIds.length };
  }

  async broadcast(dto: BroadcastNotificationDto): Promise<{ totalRecipients: number }> {
    const BATCH_SIZE = 500;
    let cursorId: string | undefined;
    let totalRecipients = 0;

    while (true) {
      const usersChunk = await this.repository.getActiveUsersChunk(BATCH_SIZE, cursorId);
      if (usersChunk.length === 0) {
        break;
      }

      const records = usersChunk.map((u) => ({
        userId: u.id,
        type: dto.type || NOTIFICATION_TYPE.SYSTEM,
        priority: dto.priority || NOTIFICATION_PRIORITY.NORMAL,
        title: dto.title,
        content: dto.content,
        actionUrl: dto.actionUrl || null,
        metadata: dto.metadata || null,
      }));

      await this.repository.createManyNotifications(records);
      totalRecipients += usersChunk.length;
      cursorId = usersChunk[usersChunk.length - 1].id;

      if (usersChunk.length < BATCH_SIZE) {
        break;
      }
    }

    if (totalRecipients > 0) {
      // Real-time Push via SSE (Broadcast)
      sseManagerService.broadcast({
        type: 'notification:broadcast',
        data: {
          title: dto.title,
          content: dto.content,
          type: dto.type || NOTIFICATION_TYPE.SYSTEM,
          priority: dto.priority || NOTIFICATION_PRIORITY.NORMAL,
          actionUrl: dto.actionUrl || null,
          createdAt: new Date().toISOString(),
        },
      });
    }

    return { totalRecipients };
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

  // ─────────────────────────────────────────────
  // Template Management Service Methods
  // ─────────────────────────────────────────────

  async listTemplates(dto: ListNotificationTemplatesDto): Promise<ListNotificationTemplatesResponseDto> {
    const { page = 1, limit = 20 } = dto;
    const [items, total] = await this.repository.findTemplates(dto);

    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        channels: item.channels,
        subject: item.subject,
        title: item.title,
        content: item.content,
        variables: item.variables,
        isSystem: item.isSystem,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTemplateByCode(code: string) {
    const template = await this.repository.findTemplateByCode(code);
    if (!template) {
      throw new AppError(`Template with code '${code}' not found`, 404, ERROR_CODE.NOT_FOUND);
    }
    return template;
  }

  async createTemplate(
    data: CreateNotificationTemplateDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findTemplateByCode(data.code);
    if (existing) {
      throw new AppError(`Template with code '${data.code}' already exists`, 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const template = await this.repository.createTemplate(data);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.CREATE_NOTIFICATION_TEMPLATE,
      targetType: AUDIT_TARGET_TYPE.NOTIFICATION_TEMPLATE,
      targetId: template.id,
      details: { code: template.code, name: template.name },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return template;
  }

  async updateTemplate(
    id: string,
    data: UpdateNotificationTemplateDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const template = await this.repository.findTemplateById(id);
    if (!template) {
      throw new AppError('Template not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const updated = await this.repository.updateTemplate(id, data);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.UPDATE_NOTIFICATION_TEMPLATE,
      targetType: AUDIT_TARGET_TYPE.NOTIFICATION_TEMPLATE,
      targetId: template.id,
      details: { code: template.code, updatedFields: Object.keys(data) },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  }

  async deleteTemplate(
    id: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const template = await this.repository.findTemplateById(id);
    if (!template) {
      throw new AppError('Template not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (template.isSystem) {
      throw new AppError('System template cannot be deleted', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    await this.repository.deleteTemplate(id);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.DELETE_NOTIFICATION_TEMPLATE,
      targetType: AUDIT_TARGET_TYPE.NOTIFICATION_TEMPLATE,
      targetId: template.id,
      details: { code: template.code, name: template.name },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  async previewTemplate(code: string, dto: PreviewNotificationTemplateDto): Promise<PreviewNotificationTemplateResponseDto> {
    const template = await this.getTemplateByCode(code);

    const subject = template.subject ? renderTemplateString(template.subject, dto.variables) : null;
    const title = template.title ? renderTemplateString(template.title, dto.variables) : null;
    const content = renderTemplateString(template.content, dto.variables);

    const channels = (template.channels as string[]) || [];
    let html: string | undefined;
    if (channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      html = this.emailTemplateService.baseLayout(title || subject || template.name, content);
    }

    return {
      code: template.code,
      subject,
      title,
      content,
      html,
    };
  }

  async testSendTemplate(
    code: string,
    userId: string,
    dto: TestSendNotificationTemplateDto,
  ): Promise<{ message: string }> {
    const template = await this.getTemplateByCode(code);

    await notificationDispatcher.sendWithTemplate({
      userId,
      templateCode: template.code,
      variables: dto.variables,
      channels: dto.channels || (template.channels as NotificationChannel[]),
      toEmail: dto.toEmail,
    });

    return { message: `Test notification sent successfully for template '${code}'` };
  }
}
