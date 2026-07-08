import { prisma } from "../../database/prisma.client";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_LOG_STATUS,
} from "../../common/constants/status.constant";
import { notificationQueue } from "../../queues/notification.queue";

const fallbacks: Record<string, { title: string; content: string }> = {
  TASK_ASSIGNMENT: {
    title: "Bạn đã được giao công việc mới",
    content: 'Công việc: "{{taskTitle}}". Hạn nộp: {{deadline}}',
  },
  TASK_SUBMISSION: {
    title: "Bản nộp bài mới cần duyệt",
    content:
      'Thực tập sinh {{internName}} đã nộp bài cho công việc "{{taskTitle}}" (Lần {{attempt}}).',
  },
  SUBMISSION_REVIEW: {
    title: "Kết quả duyệt bài nộp",
    content:
      'Bài nộp cho công việc "{{taskTitle}}" (Lần {{attempt}}) đã được duyệt: {{reviewStatus}}.',
  },
  DAILY_REPORT: {
    title: "Báo cáo hàng ngày mới",
    content: "Thực tập sinh {{internName}} đã gửi báo cáo hàng ngày.",
  },
  WEEKLY_EVALUATION: {
    title: "Đánh giá hàng tuần mới",
    content:
      "Bạn nhận được đánh giá tuần {{week}} với tổng điểm là {{totalScore}}/10.",
  },
};

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

      // 2. Fetch template from database
      const dbTemplate = await prisma.notificationTemplate.findUnique({
        where: { type },
      });

      const titleTemplate =
        dbTemplate?.titleTemplate || fallbacks[type]?.title || "Thông báo mới";
      const contentTemplate =
        dbTemplate?.contentTemplate || fallbacks[type]?.content || "";

      // 3. Interpolate parameters
      const title = interpolate(titleTemplate, params);
      const content = interpolate(contentTemplate, params);

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
        });
      }

      return notification;
    } catch (error) {
      console.error("Failed to dispatch notification:", error);
    }
  }
}
