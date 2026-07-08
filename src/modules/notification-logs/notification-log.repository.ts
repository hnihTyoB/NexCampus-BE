import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  NotificationLogQueryDto,
  CreateNotificationLogDto,
  UpdateNotificationLogDto,
} from "./notification-log.dto";

const defaultInclude = {
  notification: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  },
};

export class NotificationLogRepository {
  async findAll(query: NotificationLogQueryDto, userIdFilter?: string) {
    const {
      notificationId,
      channel,
      status,
      sortBy = "sentAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.NotificationLogWhereInput = {
      ...(notificationId ? { notificationId } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
      ...(userIdFilter
        ? {
            notification: {
              userId: userIdFilter,
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.notificationLog.findMany({
        where,
        include: defaultInclude,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.notificationLog.findFirst({
      where: { id },
      include: defaultInclude,
    });
  }

  create(data: CreateNotificationLogDto) {
    return prisma.notificationLog.create({
      data: {
        notificationId: data.notificationId,
        channel: data.channel,
        status: data.status,
      },
      include: defaultInclude,
    });
  }

  update(id: string, data: UpdateNotificationLogDto) {
    return prisma.notificationLog.update({
      where: { id },
      data: {
        ...(data.channel !== undefined ? { channel: data.channel } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: defaultInclude,
    });
  }

  delete(id: string) {
    return prisma.notificationLog.delete({
      where: { id },
    });
  }
}
