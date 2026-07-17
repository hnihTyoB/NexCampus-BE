import { prisma } from "../../database/prisma.client";
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from "./notification-template.dto";

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

  create(data: CreateNotificationTemplateDto) {
    return prisma.notificationTemplate.create({
      data: {
        type: data.type,
        titleTemplate: data.titleTemplate,
        contentTemplate: data.contentTemplate,
        emailSubjectTemplate: data.emailSubjectTemplate ?? null,
        emailContentTemplate: data.emailContentTemplate ?? null,
      },
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
        ...(data.emailSubjectTemplate !== undefined
          ? { emailSubjectTemplate: data.emailSubjectTemplate }
          : {}),
        ...(data.emailContentTemplate !== undefined
          ? { emailContentTemplate: data.emailContentTemplate }
          : {}),
      },
    });
  }

  upsertByType(
    type: string,
    data: {
      titleTemplate: string;
      contentTemplate: string;
      emailSubjectTemplate?: string | null;
      emailContentTemplate?: string | null;
    },
  ) {
    return prisma.notificationTemplate.upsert({
      where: { type },
      update: {
        titleTemplate: data.titleTemplate,
        contentTemplate: data.contentTemplate,
        emailSubjectTemplate: data.emailSubjectTemplate ?? null,
        emailContentTemplate: data.emailContentTemplate ?? null,
      },
      create: {
        type,
        titleTemplate: data.titleTemplate,
        contentTemplate: data.contentTemplate,
        emailSubjectTemplate: data.emailSubjectTemplate ?? null,
        emailContentTemplate: data.emailContentTemplate ?? null,
      },
    });
  }

  resetToDefault(
    id: string,
    defaults: {
      titleTemplate: string;
      contentTemplate: string;
      emailSubjectTemplate: string | null;
      emailContentTemplate: string | null;
    },
  ) {
    return prisma.notificationTemplate.update({
      where: { id },
      data: defaults,
    });
  }
}
