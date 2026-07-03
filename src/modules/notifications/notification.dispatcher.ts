import { prisma } from '../../database/prisma.client';
import { NOTIFICATION_CHANNEL, NOTIFICATION_LOG_STATUS } from '../../common/constants/status.constant';

export class NotificationDispatcher {
  static async dispatch(userId: string, title: string, content: string, type: string) {
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

      // 2. Create Notification
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          content,
          type,
          isRead: false,
        },
      });

      // 3. Dispatch to enabled channels and create logs
      if (settings.webEnabled) {
        await prisma.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel: NOTIFICATION_CHANNEL.WEB,
            status: NOTIFICATION_LOG_STATUS.SUCCESS,
          },
        });
      }

      if (settings.emailEnabled) {
        await prisma.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel: NOTIFICATION_CHANNEL.EMAIL,
            status: NOTIFICATION_LOG_STATUS.SUCCESS,
          },
        });
      }

      if (settings.discordEnabled) {
        await prisma.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel: NOTIFICATION_CHANNEL.DISCORD,
            status: NOTIFICATION_LOG_STATUS.SUCCESS,
          },
        });
      }

      return notification;
    } catch (error) {
      console.error('Failed to dispatch notification:', error);
    }
  }
}
