import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { LeaderQueryDto, CreateLeaderDto, UpdateLeaderDto } from "./leader.dto";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  avatarUrl: true,
};

const defaultSelect = {
  id: true,
  userId: true,
  departmentId: true,
  position: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
  department: { select: { id: true, name: true } as const },
};

export class LeaderRepository {
  async findAll(query: LeaderQueryDto) {
    const {
      fullName,
      departmentId,
      department,
      isActive,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.LeaderWhereInput = {
      ...(fullName
        ? {
            user: {
              OR: [
                { fullName: { contains: fullName, mode: "insensitive" } },
                { email: { contains: fullName, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(department
        ? {
            department: {
              name: { contains: department, mode: "insensitive" },
            },
          }
        : {}),
      ...(isActive !== undefined ? { user: { isActive } } : {}),
    };

    const skip = (page - 1) * limit;
    const orderBy = sortBy === "fullName"
      ? { user: { fullName: order } }
      : { [sortBy]: order };

    const [data, total] = await prisma.$transaction([
      prisma.leader.findMany({
        where,
        select: defaultSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.leader.count({ where }),
    ]);

    // Batch fetch intern counts for all leaders
    const userIds = data.map((l) => l.userId);
    const internCounts = await prisma.intern.groupBy({
      by: ["leaderId"],
      where: { leaderId: { in: userIds }, deletedAt: null },
      _count: { id: true },
    });
    const countMap = new Map(
      internCounts.map((c) => [c.leaderId, c._count.id]),
    );

    const dataWithCount = data.map((l) => ({
      ...l,
      internCount: countMap.get(l.userId) ?? 0,
    }));

    return {
      data: dataWithCount,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const leader = await prisma.leader.findUnique({
      where: { id },
      select: defaultSelect,
    });

    if (!leader) return null;

    const count = await prisma.intern.count({
      where: { leaderId: leader.userId, deletedAt: null },
    });

    return { ...leader, internCount: count };
  }

  findByUserId(userId: string) {
    return prisma.leader.findUnique({
      where: { userId },
      select: defaultSelect,
    });
  }

  create(data: CreateLeaderDto) {
    return prisma.leader.create({
      data: {
        userId: data.userId,
        departmentId: data.departmentId,
        position: data.position,
        phone: data.phone,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateLeaderDto) {
    return prisma.leader.update({
      where: { id },
      data: {
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.leader.delete({ where: { id } });
  }
}
