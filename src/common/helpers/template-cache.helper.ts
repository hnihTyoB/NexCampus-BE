import { prisma } from "../../database/prisma.client";

export interface CachedTemplate {
  id: string;
  type: string;
  titleTemplate: string;
  contentTemplate: string;
  emailSubjectTemplate: string | null;
  emailContentTemplate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateCacheHelper {
  static async getTemplate(type: string): Promise<CachedTemplate | null> {
    return prisma.notificationTemplate.findUnique({
      where: { type },
      select: {
        id: true,
        type: true,
        titleTemplate: true,
        contentTemplate: true,
        emailSubjectTemplate: true,
        emailContentTemplate: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  static clearCache(type?: string): void {
    // No-op: cache is removed to ensure consistency across multiple cluster instances
  }
}
