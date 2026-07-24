import { prisma } from "../../database/prisma.client";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_LOG_STATUS,
  NOTIFICATION_TYPE,
} from "../../common/constants/status.constant";
import { notificationQueue } from "../../queues/notification.queue";

import { TEMPLATE_DEFAULTS } from "../../common/constants/notification-template.constant";
import { TemplateCacheHelper } from "../../common/helpers/template-cache.helper";

const interpolate = (template: string, variables: Record<string, any>) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
  });
};

export class NotificationDispatcher {
  static async dispatch(
    userId: string,
    type: string,
    params: Record<string, any>,
  ) {
    try {
      // 1. Get user's notification settings (auto-initialize if not exist)
      let settings = await prisma.notificationSetting.findUnique({
        where: { userId },
      });

      if (!settings) {
        settings = await prisma.notificationSetting.create({
          data: {
            userId,
            webEnabled: true,
            emailEnabled: true,
            discordEnabled: false,
          },
        });
      }

      // 2. Fetch template from cache / database
      const dbTemplate = await TemplateCacheHelper.getTemplate(type);
      const fallback = TEMPLATE_DEFAULTS[type];

      const isEdited =
        dbTemplate &&
        dbTemplate.createdAt &&
        dbTemplate.updatedAt &&
        dbTemplate.createdAt.getTime() !== dbTemplate.updatedAt.getTime();

      const titleTemplate = isEdited
        ? dbTemplate.titleTemplate || fallback?.titleTemplate || "Thông báo mới"
        : fallback?.titleTemplate || "Thông báo mới";

      const contentTemplate = isEdited
        ? dbTemplate.contentTemplate || fallback?.contentTemplate || ""
        : fallback?.contentTemplate || "";

      const emailSubjectTemplate = isEdited
        ? dbTemplate.emailSubjectTemplate || dbTemplate.titleTemplate || fallback?.emailSubjectTemplate || fallback?.titleTemplate || titleTemplate
        : fallback?.emailSubjectTemplate || fallback?.titleTemplate || titleTemplate;

      const emailContentTemplate = isEdited
        ? dbTemplate.emailContentTemplate || dbTemplate.contentTemplate || fallback?.emailContentTemplate || fallback?.contentTemplate || contentTemplate
        : fallback?.emailContentTemplate || fallback?.contentTemplate || contentTemplate;

      // 3. Interpolate parameters
      const title = interpolate(titleTemplate, params);
      const content = interpolate(contentTemplate, params);
      const emailSubject = interpolate(emailSubjectTemplate, params);
      const emailContent = interpolate(emailContentTemplate, params);

      // 4. Create Notification record
      const notification = await prisma.notification.create({
        data: { userId, title, content, type, isRead: false },
      });

      // 5. WEB channel — synchronous, instant
      if (settings.webEnabled) {
        await prisma.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel: NOTIFICATION_CHANNEL.WEB,
            status: NOTIFICATION_LOG_STATUS.SUCCESS,
          },
        });
      }

      // 6. EMAIL and DISCORD — asynchronous via BullMQ queue
      const needsAsync = settings.emailEnabled || settings.discordEnabled;
      if (needsAsync) {
        await notificationQueue.add(`notify-${notification.id}`, {
          notificationId: notification.id,
          userId,
          title,
          content,
          emailEnabled: settings.emailEnabled,
          discordEnabled: settings.discordEnabled,
          emailSubject,
          emailContent,
        });
      }

      return notification;
    } catch (error) {
      console.error("Failed to dispatch notification:", error);
    }
  }
}
