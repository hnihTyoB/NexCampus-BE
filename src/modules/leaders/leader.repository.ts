import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  LeaderQueryDto,
  CreateLeaderDto,
  UpdateLeaderDto,
  UpdateMeLeaderDto,
} from "./leader.dto";

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
  position: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
  departments: {
    select: {
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.LeaderSelect;

type LeaderRecord = Prisma.LeaderGetPayload<{ select: typeof defaultSelect }>;

function serializeLeader(leader: LeaderRecord) {
  const departments = leader.departments.map(
    (membership) => membership.department,
  );

  return {
    ...leader,
    departments,
    // Keep the first department fields during the API transition.
    departmentId: departments[0]?.id ?? null,
    department: departments[0] ?? null,
  };
}

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
      ...(departmentId
        ? { departments: { some: { departmentId } } }
        : {}),
      ...(department
        ? {
            departments: {
              some: {
                department: {
                  name: { contains: department, mode: "insensitive" },
                },
              },
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

    const dataWithCount = data.map((leader) => ({
      ...serializeLeader(leader),
      internCount: countMap.get(leader.userId) ?? 0,
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

    return { ...serializeLeader(leader), internCount: count };
  }

  async findByUserId(userId: string) {
    const leader = await prisma.leader.findUnique({
      where: { userId },
      select: defaultSelect,
    });

    return leader ? serializeLeader(leader) : null;
  }

  async create(data: CreateLeaderDto, departmentIds: string[]) {
    const leader = await prisma.$transaction(async (tx) => {
      if (departmentIds.length > 0) {
        await tx.leaderDepartment.deleteMany({
          where: {
            departmentId: { in: departmentIds },
          },
        });
      }

      return tx.leader.create({
        data: {
          userId: data.userId,
          position: data.position,
          phone: data.phone,
          departments: departmentIds.length
            ? {
                create: departmentIds.map((departmentId) => ({ departmentId })),
              }
            : undefined,
        },
        select: defaultSelect,
      });
    });

    return serializeLeader(leader);
  }

  async update(
    id: string,
    data: UpdateLeaderDto | UpdateMeLeaderDto,
    departmentIds?: string[],
  ) {
    const leader = await prisma.$transaction(async (tx) => {
      if (departmentIds !== undefined && departmentIds.length > 0) {
        await tx.leaderDepartment.deleteMany({
          where: {
            departmentId: { in: departmentIds },
            leaderId: { not: id },
          },
        });
      }

      return tx.leader.update({
        where: { id },
        data: {
          ...("position" in data && data.position !== undefined
            ? { position: data.position }
            : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(departmentIds !== undefined
            ? {
                departments: {
                  deleteMany: {},
                  create: departmentIds.map((departmentId) => ({ departmentId })),
                },
              }
            : {}),
        },
        select: defaultSelect,
      });
    });

    return serializeLeader(leader);
  }

  delete(id: string) {
    return prisma.leader.delete({ where: { id } });
  }
}
