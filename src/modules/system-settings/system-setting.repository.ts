import { prisma } from "../../database/prisma.client";

export class SystemSettingRepository {
  async getAll() {
    return prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });
  }

  async getByKey(key: string) {
    return prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  async upsert(
    key: string,
    value: string,
    category = "GENERAL",
    description?: string
  ) {
    return prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        category,
        description,
      },
      update: {
        value,
        category: category || undefined,
        description: description !== undefined ? description : undefined,
      },
    });
  }

  async delete(key: string) {
    return prisma.systemSetting.delete({
      where: { key },
    });
  }
}

export const systemSettingRepository = new SystemSettingRepository();
