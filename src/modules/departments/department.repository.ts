import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
  DepartmentQueryDto,
  DepartmentDto,
  PositionDto,
} from "./department.dto";

const positionSelect = {
  id: true,
  departmentId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
};

const departmentWithRelationsSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  positions: {
    where: { deletedAt: null },
    select: positionSelect,
    orderBy: { name: "asc" as const },
  },
  leaderAssignments: {
    select: {
      leader: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      positions: { where: { deletedAt: null } },
      interns: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.DepartmentSelect;

type DepartmentRecord = Prisma.DepartmentGetPayload<{
  select: typeof departmentWithRelationsSelect;
}>;

function serializeDepartment(department: DepartmentRecord): DepartmentDto {
  const { leaderAssignments, _count, ...data } = department;
  return {
    ...data,
    leaders: leaderAssignments.map((assignment) => assignment.leader),
    positionsCount: _count.positions,
    internsCount: _count.interns,
    _count,
  };
}

export class DepartmentRepository {
  // ─── Departments ─────────────────────────────────────────────────

  async findAll(
    departmentIds?: string[],
    filters?: DepartmentQueryDto,
  ): Promise<DepartmentDto[]> {
    const where: Prisma.DepartmentWhereInput = {
      deletedAt: null,
    };

    if (departmentIds) {
      where.id = { in: departmentIds };
    }

    if (filters?.name) {
      where.name = {
        contains: filters.name,
        mode: "insensitive",
      };
    }

    if (filters?.leader) {
      where.leaderAssignments = {
        some: {
          leader: {
            user: {
              OR: [
                { fullName: { contains: filters.leader, mode: "insensitive" } },
                { email: { contains: filters.leader, mode: "insensitive" } },
              ],
            },
          },
        },
      };
    }

    const departments = await prisma.department.findMany({
      where,
      select: departmentWithRelationsSelect,
      orderBy: { name: "asc" },
    });

    return departments.map(serializeDepartment);
  }

  async findDepartmentIdsByLeaderUserId(userId: string): Promise<string[]> {
    const leader = await prisma.leader.findFirst({
      where: { userId },
      select: { departments: { select: { departmentId: true } } },
    });
    return leader?.departments.map((item) => item.departmentId) ?? [];
  }

  async findById(id: string): Promise<DepartmentDto | null> {
    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: departmentWithRelationsSelect,
    });

    return department ? serializeDepartment(department) : null;
  }

  async findByName(name: string): Promise<DepartmentDto | null> {
    const department = await prisma.department.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      },
      select: departmentWithRelationsSelect,
    });

    return department ? serializeDepartment(department) : null;
  }

  async create(data: CreateDepartmentDto): Promise<DepartmentDto> {
    const hasPositions = data.positions && data.positions.length > 0;
    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        positions: hasPositions
          ? {
              create: data.positions!.map((posName) => ({ name: posName })),
            }
          : undefined,
      },
      select: departmentWithRelationsSelect,
    });

    return serializeDepartment(department);
  }

  async update(id: string, data: UpdateDepartmentDto): Promise<DepartmentDto> {
    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      select: departmentWithRelationsSelect,
    });

    return serializeDepartment(department);
  }

  async hasAssociations(id: string): Promise<boolean> {
    const [intern, leader] = await Promise.all([
      prisma.intern.findFirst({ where: { departmentId: id, deletedAt: null } }),
      prisma.leaderDepartment.findFirst({ where: { departmentId: id } }),
    ]);
    return !!(intern || leader);
  }

  async softDelete(id: string): Promise<DepartmentDto> {
    return prisma.$transaction(async (tx) => {
      // Soft delete associated positions
      await tx.position.updateMany({
        where: { departmentId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Remove leader assignments
      await tx.leaderDepartment.deleteMany({
        where: { departmentId: id },
      });

      const department = await tx.department.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: departmentWithRelationsSelect,
      });

      return serializeDepartment(department);
    });
  }

  // ─── Positions ───────────────────────────────────────────────────

  async hasPositionAssociations(id: string): Promise<boolean> {
    const intern = await prisma.intern.findFirst({
      where: { positionId: id, deletedAt: null },
    });
    return !!intern;
  }

  async findPositionsByDepartment(departmentId: string): Promise<PositionDto[]> {
    return prisma.position.findMany({
      where: { departmentId, deletedAt: null },
      select: positionSelect,
      orderBy: { name: "asc" },
    });
  }

  async findPositionById(id: string): Promise<PositionDto | null> {
    return prisma.position.findFirst({
      where: { id, deletedAt: null },
      select: positionSelect,
    });
  }

  async createPosition(data: CreatePositionDto): Promise<PositionDto> {
    return prisma.position.create({
      data: {
        departmentId: data.departmentId,
        name: data.name,
      },
      select: positionSelect,
    });
  }

  async updatePosition(
    id: string,
    data: UpdatePositionDto,
  ): Promise<PositionDto> {
    return prisma.position.update({
      where: { id },
      data: {
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
      select: positionSelect,
    });
  }

  async deletePosition(id: string): Promise<PositionDto> {
    return prisma.position.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: positionSelect,
    });
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
