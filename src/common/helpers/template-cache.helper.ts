import { prisma } from "../../database/prisma.client";

export interface CachedTemplate {
  id: string;
  type: string;
  titleTemplate: string;
  contentTemplate: string;
  emailSubjectTemplate: string | null;
  emailContentTemplate: string | null;
}

const cache = new Map<string, { data: CachedTemplate | null; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export class TemplateCacheHelper {
  static async getTemplate(type: string): Promise<CachedTemplate | null> {
    const now = Date.now();
    const hit = cache.get(type);

    if (hit && now < hit.expiresAt) {
      return hit.data;
    }

    const template = await prisma.notificationTemplate.findUnique({
      where: { type },
      select: {
        id: true,
        type: true,
        titleTemplate: true,
        contentTemplate: true,
        emailSubjectTemplate: true,
        emailContentTemplate: true,
      },
    });

    cache.set(type, { data: template, expiresAt: now + TTL_MS });
    return template;
  }

  static clearCache(type?: string): void {
    if (type) {
      cache.delete(type);
    } else {
      cache.clear();
    }
  }
}
