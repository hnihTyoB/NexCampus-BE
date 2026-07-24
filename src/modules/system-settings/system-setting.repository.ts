import { prisma } from "../../database/prisma.client";

export class SystemSettingRepository {
  async get(key: string) {
    return prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  async getAll() {
    return prisma.systemSetting.findMany();
  }

  async update(key: string, value: string) {
    return prisma.systemSetting.update({
      where: { key },
      data: { value },
    });
  }
}
