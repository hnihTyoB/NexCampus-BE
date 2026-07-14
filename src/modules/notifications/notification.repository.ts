import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  NotificationQueryDto,
  CreateNotificationDto,
} from "./notification.dto";

const defaultSelect = {
  id: true,
  userId: true,
  title: true,
  content: true,
  type: true,
  isRead: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
};

export class NotificationRepository {
  async findAll(query: NotificationQueryDto, userIdFilter?: string) {
    const {
      userId,
      isRead,
      type,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.NotificationWhereInput = {
      ...(userIdFilter ? { userId: userIdFilter } : userId ? { userId } : {}),
      ...(isRead !== undefined ? { isRead } : {}),
      ...(type ? { type } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.notification.findFirst({
      where: { id },
      select: defaultSelect,
    });
  }

  create(data: CreateNotificationDto) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        content: data.content,
        type: data.type,
      },
      select: defaultSelect,
    });
  }

  markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  }
}
