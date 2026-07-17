import { z } from "zod";
import { NOTIFICATION_CHANNEL, NOTIFICATION_LOG_STATUS } from "../../common/constants/status.constant";

export const findAllNotificationLogSchema = z.object({
  notificationId: z.string().uuid().optional(),
  channel: z.enum([NOTIFICATION_CHANNEL.WEB, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.DISCORD]).optional(),
  status: z.enum([NOTIFICATION_LOG_STATUS.SUCCESS, NOTIFICATION_LOG_STATUS.FAILED]).optional(),
  sortBy: z.enum(["sentAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createNotificationLogSchema = z.object({
  notificationId: z.string().uuid(),
  channel: z.enum([NOTIFICATION_CHANNEL.WEB, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.DISCORD]),
  status: z.enum([NOTIFICATION_LOG_STATUS.SUCCESS, NOTIFICATION_LOG_STATUS.FAILED]),
});

export const updateNotificationLogSchema = z.object({
  channel: z.enum([NOTIFICATION_CHANNEL.WEB, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.DISCORD]).optional(),
  status: z.enum([NOTIFICATION_LOG_STATUS.SUCCESS, NOTIFICATION_LOG_STATUS.FAILED]).optional(),
});
