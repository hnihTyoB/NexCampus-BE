import { prisma } from "../../database/prisma.client";
import { UpdateNotificationSettingDto } from "./notification-setting.dto";

export class NotificationSettingRepository {
  findByUserId(userId: string) {
    return prisma.notificationSetting.findUnique({
      where: { userId },
    });
  }

  createDefault(userId: string) {
    return prisma.notificationSetting.create({
      data: {
        userId,
        webEnabled: true,
        emailEnabled: true,
        discordEnabled: false,
      },
    });
  }

  update(userId: string, data: UpdateNotificationSettingDto) {
    return prisma.notificationSetting.update({
      where: { userId },
      data: {
        ...(data.webEnabled !== undefined
          ? { webEnabled: data.webEnabled }
          : {}),
        ...(data.emailEnabled !== undefined
          ? { emailEnabled: data.emailEnabled }
          : {}),
        ...(data.discordEnabled !== undefined
          ? { discordEnabled: data.discordEnabled }
          : {}),
      },
    });
  }
}
