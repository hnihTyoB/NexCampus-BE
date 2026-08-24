import { prisma } from '../../database/prisma.client';
import { Prisma } from '@prisma/client';
import { CreateSystemConfigDto, UpdateSystemConfigDto, SystemConfigQueryDto } from './system-config.dto';

export class SystemConfigRepository {
  async findAll(query: SystemConfigQueryDto) {
    const where: Prisma.SystemConfigWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.isPublic !== undefined ? { isPublic: query.isPublic } : {}),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.systemConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findByKey(key: string) {
    return prisma.systemConfig.findUnique({
      where: { key },
    });
  }

  async findById(id: string) {
    return prisma.systemConfig.findUnique({
      where: { id },
    });
  }

  async findPublicConfigs() {
    return prisma.systemConfig.findMany({
      where: { isPublic: true },
      select: {
        key: true,
        value: true,
        category: true,
        description: true,
      },
    });
  }

  async create(data: CreateSystemConfigDto) {
    return prisma.systemConfig.create({
      data: {
        key: data.key,
        value: data.value as Prisma.InputJsonValue,
        description: data.description,
        category: data.category || 'GENERAL',
        isPublic: data.isPublic ?? false,
      },
    });
  }

  async update(key: string, data: UpdateSystemConfigDto) {
    const updateData: Prisma.SystemConfigUpdateInput = {};
    if (data.value !== undefined) updateData.value = data.value as Prisma.InputJsonValue;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    return prisma.systemConfig.update({
      where: { key },
      data: updateData,
    });
  }

  async upsert(key: string, data: CreateSystemConfigDto) {
    return prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: data.value as Prisma.InputJsonValue,
        description: data.description,
        category: data.category,
        isPublic: data.isPublic,
      },
      create: {
        key: data.key,
        value: data.value as Prisma.InputJsonValue,
        description: data.description,
        category: data.category || 'GENERAL',
        isPublic: data.isPublic ?? false,
      },
    });
  }

  async delete(key: string) {
    return prisma.systemConfig.delete({
      where: { key },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const systemConfigRepository = new SystemConfigRepository();
