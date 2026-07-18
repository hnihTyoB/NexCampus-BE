import { prisma } from "../../database/prisma.client";
import { CreateRegulationDto, UpdateRegulationDto } from "./regulation.dto";

export class RegulationRepository {
  async create(data: CreateRegulationDto) {
    const latest = await prisma.regulation.findFirst({
      orderBy: { version: "desc" },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    return prisma.regulation.create({
      data: {
        title: data.title,
        content: data.content,
        version: nextVersion,
        isActive: data.isActive ?? false,
      },
    });
  }

  async findAll(query: { page?: number; limit?: number; title?: string; isActive?: boolean }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.title) {
      where.title = {
        contains: query.title,
        mode: "insensitive",
      };
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [total, items] = await Promise.all([
      prisma.regulation.count({ where }),
      prisma.regulation.findMany({
        where,
        orderBy: { version: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, items };
  }

  async findById(id: string) {
    return prisma.regulation.findUnique({
      where: { id },
    });
  }

  async findActive() {
    return prisma.regulation.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });
  }

  async update(id: string, data: UpdateRegulationDto) {
    return prisma.regulation.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.regulation.delete({
      where: { id },
    });
  }

  async isUsed(id: string): Promise<boolean> {
    const count = await prisma.application.count({
      where: { regulationId: id },
    });
    return count > 0;
  }

  async setActive(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.regulation.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.regulation.update({
        where: { id },
        data: { isActive: true },
      });
    }, {
      isolationLevel: "Serializable",
    });
  }
}
