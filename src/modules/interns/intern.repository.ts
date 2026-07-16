import { InternStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { InternQueryDto, CreateInternDto, UpdateInternDto } from "./intern.dto";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
};

const defaultSelect = {
  id: true,
  userId: true,
  leaderId: true,
  fullName: true,
  phone: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  startDate: true,
  duration: true,
  discordUsername: true,
  discordRoleGranted: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
  leader: { select: userSelect },
};

export class InternRepository {
  async findAll(query: InternQueryDto) {
    const {
      fullName,
      departmentId,
      positionId,
      status,
      leaderId,
      discordRoleGranted,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.InternWhereInput = {
      deletedAt: null,
      ...(fullName
        ? { fullName: { contains: fullName, mode: "insensitive" } }
        : {}),
      ...(departmentId
        ? { departmentId }
        : {}),
      ...(positionId
        ? { positionId }
        : {}),
      ...(status ? { status } : {}),
      ...(leaderId ? { leaderId } : {}),
      ...(discordRoleGranted !== undefined ? { discordRoleGranted } : {}),
      ...(startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
              ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.intern.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.intern.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.intern.findFirst({
      where: { id, deletedAt: null },
      select: defaultSelect,
    });
  }

  findByUserId(userId: string) {
    return prisma.intern.findFirst({
      where: { userId, deletedAt: null },
      select: defaultSelect,
    });
  }

  // Lazy auto-complete: chuyển ACTIVE → COMPLETED nếu đã hết thời gian
  async completeExpiredInterns() {
    const expiredInterns = await prisma.intern.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, startDate: true, duration: true },
    });

    const now = new Date();
    const expiredIds = expiredInterns
      .filter((i) => {
        const endDate = new Date(i.startDate);
        endDate.setMonth(endDate.getMonth() + i.duration);
        return endDate < now;
      })
      .map((i) => i.id);

    if (expiredIds.length > 0) {
      await prisma.intern.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: "COMPLETED" },
      });
    }
  }

  create(data: CreateInternDto) {
    return prisma.intern.create({
      data: {
        userId: data.userId,
        leaderId: data.leaderId,
        fullName: data.fullName,
        phone: data.phone,
        departmentId: data.departmentId,
        positionId: data.positionId,
        startDate: new Date(data.startDate),
        duration: data.duration,
        discordUsername: data.discordUsername,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateInternDto) {
    return prisma.intern.update({
      where: { id },
      data: {
        ...(data.leaderId !== undefined ? { leaderId: data.leaderId } : {}),
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.positionId !== undefined ? { positionId: data.positionId } : {}),
        ...(data.startDate !== undefined
          ? { startDate: new Date(data.startDate) }
          : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
        ...(data.discordUsername !== undefined
          ? { discordUsername: data.discordUsername }
          : {}),
        ...(data.discordRoleGranted !== undefined
          ? { discordRoleGranted: data.discordRoleGranted }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      select: defaultSelect,
    });
  }

  softDelete(id: string) {
    return prisma.intern.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: defaultSelect,
    });
  }
}
