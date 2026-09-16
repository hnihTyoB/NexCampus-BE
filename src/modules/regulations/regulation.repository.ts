import { prisma } from "../../database/prisma.client";
import { CreateRegulationDto, UpdateRegulationDto, RegulationQueryDto } from "./regulation.dto";

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

  async findAll(query: RegulationQueryDto, internId?: string) {
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
        include: {
          _count: {
            select: { acknowledgments: true },
          },
          acknowledgments: internId
            ? {
                where: { internId },
                select: { id: true, acknowledgedAt: true },
              }
            : false,
        },
      }),
    ]);

    const formattedItems = items.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      version: item.version,
      isActive: item.isActive,
      totalAcknowledged: item._count?.acknowledgments || 0,
      isAcknowledged: Boolean(item.acknowledgments && item.acknowledgments.length > 0),
      acknowledgedAt: item.acknowledgments?.[0]?.acknowledgedAt
        ? item.acknowledgments[0].acknowledgedAt.toISOString()
        : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return { total, page, limit, items: formattedItems };
  }

  async findById(id: string, internId?: string) {
    const item = await prisma.regulation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { acknowledgments: true },
        },
        acknowledgments: internId
          ? {
              where: { internId },
              select: { id: true, acknowledgedAt: true },
            }
          : false,
      },
    });

    if (!item) return null;

    const typedItem = item as any;
    return {
      id: typedItem.id,
      title: typedItem.title,
      content: typedItem.content,
      version: typedItem.version,
      isActive: typedItem.isActive,
      totalAcknowledged: typedItem._count?.acknowledgments || 0,
      isAcknowledged: Boolean(typedItem.acknowledgments && typedItem.acknowledgments.length > 0),
      acknowledgedAt: typedItem.acknowledgments?.[0]?.acknowledgedAt
        ? typedItem.acknowledgments[0].acknowledgedAt.toISOString()
        : null,
      createdAt: typedItem.createdAt.toISOString(),
      updatedAt: typedItem.updatedAt.toISOString(),
    };
  }

  async findActive(internId?: string) {
    const item = await prisma.regulation.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      include: {
        _count: {
          select: { acknowledgments: true },
        },
        acknowledgments: internId
          ? {
              where: { internId },
              select: { id: true, acknowledgedAt: true },
            }
          : false,
      },
    });

    if (!item) return null;

    const typedItem = item as any;
    return {
      id: typedItem.id,
      title: typedItem.title,
      content: typedItem.content,
      version: typedItem.version,
      isActive: typedItem.isActive,
      totalAcknowledged: typedItem._count?.acknowledgments || 0,
      isAcknowledged: Boolean(typedItem.acknowledgments && typedItem.acknowledgments.length > 0),
      acknowledgedAt: typedItem.acknowledgments?.[0]?.acknowledgedAt
        ? typedItem.acknowledgments[0].acknowledgedAt.toISOString()
        : null,
      createdAt: typedItem.createdAt.toISOString(),
      updatedAt: typedItem.updatedAt.toISOString(),
    };
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
    const [appCount, ackCount] = await Promise.all([
      prisma.application.count({ where: { regulationId: id } }),
      prisma.regulationAcknowledgment.count({ where: { regulationId: id } }),
    ]);
    return appCount > 0 || ackCount > 0;
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
    });
  }

  async acknowledge(
    regulationId: string,
    internId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.regulationAcknowledgment.upsert({
      where: {
        regulationId_internId: {
          regulationId,
          internId,
        },
      },
      create: {
        regulationId,
        internId,
        ipAddress,
        userAgent,
        acknowledgedAt: new Date(),
      },
      update: {
        ipAddress,
        userAgent,
        acknowledgedAt: new Date(),
      },
    });
  }

  async findInternIdByUserId(userId: string): Promise<string | null> {
    const intern = await prisma.intern.findUnique({
      where: { userId },
      select: { id: true },
    });
    return intern ? intern.id : null;
  }
}

export const regulationRepository = new RegulationRepository();
