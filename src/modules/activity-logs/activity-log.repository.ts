import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { ActivityLogQueryDto, CreateActivityLogDto } from "./activity-log.dto";

const defaultSelect = {
  id: true,
  userId: true,
  action: true,
  targetId: true,
  targetType: true,
  description: true,
  createdAt: true,
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
    const parsedPage = Number(query.page || 1);
    const parsedLimit = Number(query.limit || 20);
    const sortBy = query.sortBy || "createdAt";
    const order = query.order || "desc";

    const where: Prisma.ActivityLogWhereInput = {
      ...(userIdFilter ? { userId: userIdFilter } : query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };

    const skip = (parsedPage - 1) * parsedLimit;

    const [data, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: parsedLimit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: { 
        total, 
        page: parsedPage, 
        limit: parsedLimit, 
        totalPages: Math.ceil(total / parsedLimit) 
      },
    };
  }

  findById(id: string) {
    return prisma.activityLog.findUnique({
      where: { id },
      select: defaultSelect,
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
      select: defaultSelect,
    });
  }
}
