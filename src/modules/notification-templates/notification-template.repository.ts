import { prisma } from "../../database/prisma.client";
import { UpdateNotificationTemplateDto } from "./notification-template.dto";

export class NotificationTemplateRepository {
  findAll() {
    return prisma.notificationTemplate.findMany({
      orderBy: { type: "asc" },
    });
  }

  findById(id: string) {
    return prisma.notificationTemplate.findFirst({
      where: { id },
    });
  }

  findByType(type: string) {
    return prisma.notificationTemplate.findUnique({
      where: { type },
    });
  }

  update(id: string, data: UpdateNotificationTemplateDto) {
    return prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(data.titleTemplate !== undefined
          ? { titleTemplate: data.titleTemplate }
          : {}),
        ...(data.contentTemplate !== undefined
          ? { contentTemplate: data.contentTemplate }
          : {}),
      },
    });
  }
}
