import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  LeaderQueryDto,
  CreateLeaderDto,
  UpdateLeaderDto,
  UpdateMeLeaderDto,
  BatchUpdateLeaderItemDto,
  LeaderDto,
} from "./leader.dto";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  isActive: true,
  role: {
    select: {
      id: true,
      name: true,
      portalType: true,
    },
  },
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

function serializeLeader(
  leader: LeaderRecord,
  internCount = 0,
): LeaderDto {
  const departments = leader.departments.map(
    (membership) => membership.department,
  );

  return {
    id: leader.id,
    userId: leader.userId,
    position: leader.position,
    phone: leader.phone,
    createdAt: leader.createdAt,
    updatedAt: leader.updatedAt,
    user: leader.user,
    departments,
    departmentId: departments[0]?.id ?? null,
    department: departments[0] ?? null,
    internCount,
  };
}

export class LeaderRepository {
  async findAll(query: LeaderQueryDto): Promise<{
    data: LeaderDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
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
      user: {
        deletedAt: null,
        role: { portalType: "LEADER" },
        ...(isActive !== undefined ? { isActive } : {}),
        ...(fullName
          ? {
              OR: [
                { fullName: { contains: fullName, mode: "insensitive" } },
                { email: { contains: fullName, mode: "insensitive" } },
              ],
            }
          : {}),
      },
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
    };

    const skip = (page - 1) * limit;
    const orderBy =
      sortBy === "fullName"
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

    // Batch fetch intern counts for leaders
    const userIds = data.map((l) => l.userId);
    const internCounts = await prisma.intern.groupBy({
      by: ["leaderId"],
      where: { leaderId: { in: userIds }, deletedAt: null },
      _count: { id: true },
    });
    const countMap = new Map(
      internCounts.map((c) => [c.leaderId, c._count.id]),
    );

    const dataWithCount = data.map((leader) =>
      serializeLeader(leader, countMap.get(leader.userId) ?? 0),
    );

    return {
      data: dataWithCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: string): Promise<LeaderDto | null> {
    const leader = await prisma.leader.findUnique({
      where: { id },
      select: defaultSelect,
    });

    if (!leader) return null;

    // Fetch interns supervised directly by this leader
    const interns = await prisma.intern.findMany({
      where: { leaderId: leader.userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        startDate: true,
        duration: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = serializeLeader(leader, interns.length);
    serialized.interns = interns;
    return serialized;
  }

  async findByUserId(userId: string): Promise<LeaderDto | null> {
    const leader = await prisma.leader.findUnique({
      where: { userId },
      select: defaultSelect,
    });

    if (!leader) return null;

    const internCount = await prisma.intern.count({
      where: { leaderId: leader.userId, deletedAt: null },
    });

    return serializeLeader(leader, internCount);
  }

  async create(
    data: CreateLeaderDto,
    departmentIds: string[],
  ): Promise<LeaderDto> {
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
                create: departmentIds.map((departmentId) => ({
                  departmentId,
                })),
              }
            : undefined,
        },
        select: defaultSelect,
      });
    });

    return serializeLeader(leader, 0);
  }

  async update(
    id: string,
    data: UpdateLeaderDto | UpdateMeLeaderDto,
    departmentIds?: string[],
    resetPosition = false,
  ): Promise<LeaderDto> {
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
          ...(resetPosition
            ? { position: null }
            : "position" in data && data.position !== undefined
              ? { position: data.position }
              : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(departmentIds !== undefined
            ? {
                departments: {
                  deleteMany: {},
                  create: departmentIds.map((departmentId) => ({
                    departmentId,
                  })),
                },
              }
            : {}),
        },
        select: defaultSelect,
      });
    });

    const internCount = await prisma.intern.count({
      where: { leaderId: leader.userId, deletedAt: null },
    });

    return serializeLeader(leader, internCount);
  }

  async batchUpdate(
    items: Array<
      BatchUpdateLeaderItemDto & {
        resetPosition?: boolean;
      }
    >,
    actorId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<LeaderDto[]> {
    return prisma.$transaction(async (tx) => {
      const results: LeaderDto[] = [];

      for (const item of items) {
        if (item.departmentIds !== undefined && item.departmentIds.length > 0) {
          await tx.leaderDepartment.deleteMany({
            where: {
              departmentId: { in: item.departmentIds },
              leaderId: { not: item.id },
            },
          });
        }

        const updateData: Prisma.LeaderUpdateInput = {
          ...(item.resetPosition
            ? { position: null }
            : item.position !== undefined
              ? { position: item.position }
              : {}),
          ...(item.phone !== undefined ? { phone: item.phone } : {}),
          ...(item.departmentIds !== undefined
            ? {
                departments: {
                  deleteMany: {},
                  create: item.departmentIds.map((departmentId) => ({
                    departmentId,
                  })),
                },
              }
            : {}),
        };

        const updated = await tx.leader.update({
          where: { id: item.id },
          data: updateData,
          select: defaultSelect,
        });

        if (item.isActive !== undefined && updated.userId) {
          await tx.user.update({
            where: { id: updated.userId },
            data: { isActive: item.isActive },
          });
          updated.user.isActive = item.isActive;
        }

        const internCount = await tx.intern.count({
          where: { leaderId: updated.userId, deletedAt: null },
        });

        await tx.auditLog.create({
          data: {
            actorId: actorId ?? null,
            action: AUDIT_ACTION.UPDATE_LEADER,
            targetType: AUDIT_TARGET_TYPE.LEADER,
            targetId: item.id,
            details: {
              batchUpdate: true,
              departmentIds: item.departmentIds,
              position: item.resetPosition ? null : item.position,
              isActive: item.isActive,
            },
            ipAddress: context?.ipAddress ?? null,
            userAgent: context?.userAgent ?? null,
          },
        });

        results.push(serializeLeader(updated, internCount));
      }

      if (items.length > 0) {
        await tx.auditLog.create({
          data: {
            actorId: actorId ?? null,
            action: AUDIT_ACTION.BATCH_UPDATE_LEADERS,
            targetType: AUDIT_TARGET_TYPE.LEADER,
            targetId: items[0].id,
            details: {
              totalItems: items.length,
              ids: items.map((i) => i.id),
            },
            ipAddress: context?.ipAddress ?? null,
            userAgent: context?.userAgent ?? null,
          },
        });
      }

      return results;
    });
  }

  async delete(id: string): Promise<LeaderDto> {
    const leader = await prisma.leader.delete({
      where: { id },
      select: defaultSelect,
    });
    return serializeLeader(leader, 0);
  }

  // ─── Audit Log ───────────────────────────────────────────────────

  createAuditLog(data: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    details?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }
}
