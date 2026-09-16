import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { CreateAuditLogInput, QueryActivityLogDto } from "./activity-log.dto";
import { toCalendarDate } from "../../common/helpers/date.helper";

const defaultAuditLogSelect = {
  id: true,
  actorId: true,
  action: true,
  targetType: true,
  targetId: true,
  details: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
    },
  },
};

export class ActivityLogRepository {
  async findMany(query: QueryActivityLogDto) {
    const {
      page = 1,
      limit = 20,
      actorId,
      action,
      targetType,
      from,
      to,
      sortBy = "createdAt",
      order = "desc",
    } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(actorId ? { actorId } : {}),
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: toCalendarDate(from) } : {}),
              ...(to
                ? {
                    lte: new Date(
                      toCalendarDate(to).getTime() + 24 * 3600 * 1000 - 1,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: defaultAuditLogSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return prisma.auditLog.findUnique({
      where: { id },
      select: defaultAuditLogSelect,
    });
  }

  async create(data: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || "SYSTEM",
        details: (data.details as Prisma.InputJsonValue) || undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      select: defaultAuditLogSelect,
    });
  }
}
