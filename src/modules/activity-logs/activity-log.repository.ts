import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { ActivityLogQueryDto, CreateActivityLogDto } from "./activity-log.dto";

const defaultInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  },
};

export class ActivityLogRepository {
  async findAll(query: ActivityLogQueryDto, userIdFilter?: string) {
    const {
      userId,
      action,
      targetId,
      targetType,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ActivityLogWhereInput = {
      ...(userIdFilter ? { userId: userIdFilter } : userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(targetId ? { targetId } : {}),
      ...(targetType ? { targetType } : {}),
    };

    const skip = (page - 1) * (limit ?? 20);

    const [data, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        include: defaultInclude,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.activityLog.findUnique({
      where: { id },
      include: defaultInclude,
    });
  }

  create(data: CreateActivityLogDto) {
    return prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        targetId: data.targetId,
        targetType: data.targetType,
        description: data.description,
      },
      include: defaultInclude,
    });
  }
}
