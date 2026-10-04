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
  DepartmentManagerDto,
  AssignDepartmentManagerDto,
  UpdateDepartmentManagerDto,
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
  managers: {
    select: {
      departmentId: true,
      userId: true,
      title: true,
      isPrimary: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { isPrimary: "desc" as const },
      { createdAt: "asc" as const },
    ],
  },
  _count: {
    select: {
      positions: { where: { deletedAt: null } },
      internshipProfiles: { where: { deletedAt: null } },
      managers: true,
    },
  },
} satisfies Prisma.DepartmentSelect;

type DepartmentRecord = Prisma.DepartmentGetPayload<{
  select: typeof departmentWithRelationsSelect;
}>;

function serializeDepartment(department: DepartmentRecord): DepartmentDto {
  const { managers, _count, ...data } = department;
  const managersList: DepartmentManagerDto[] = (managers || []).map((m) => ({
    departmentId: m.departmentId,
    userId: m.userId,
    title: m.title,
    isPrimary: m.isPrimary,
    createdAt: m.createdAt,
    user: m.user,
  }));

  const leadersCompat = managersList.map((m) => ({
    id: m.userId,
    user: m.user,
  }));

  return {
    ...data,
    managers: managersList,
    leaders: leadersCompat,
    positionsCount: _count.positions,
    internsCount: _count.internshipProfiles,
    _count: {
      positions: _count.positions,
      internshipProfiles: _count.internshipProfiles,
      interns: _count.internshipProfiles,
      managers: _count.managers,
    },
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
      where.managers = {
        some: {
          user: {
            OR: [
              { fullName: { contains: filters.leader, mode: "insensitive" } },
              { email: { contains: filters.leader, mode: "insensitive" } },
            ],
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
    const managers = await prisma.departmentManager.findMany({
      where: { userId },
      select: { departmentId: true },
    });
    return managers.map((item) => item.departmentId);
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
    const [internProfile, manager] = await Promise.all([
      prisma.internshipProfile.findFirst({ where: { departmentId: id, deletedAt: null } }),
      prisma.departmentManager.findFirst({ where: { departmentId: id } }),
    ]);
    return !!(internProfile || manager);
  }

  async softDelete(id: string): Promise<DepartmentDto> {
    return prisma.$transaction(async (tx) => {
      // Soft delete associated positions
      await tx.position.updateMany({
        where: { departmentId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Remove department manager assignments
      await tx.departmentManager.deleteMany({
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

  // ─── Department Managers ──────────────────────────────────────────

  async findManagersByDepartmentId(departmentId: string): Promise<DepartmentManagerDto[]> {
    const managers = await prisma.departmentManager.findMany({
      where: { departmentId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return managers.map((m) => ({
      departmentId: m.departmentId,
      userId: m.userId,
      title: m.title,
      isPrimary: m.isPrimary,
      createdAt: m.createdAt,
      user: m.user,
    }));
  }

  async findActiveUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        role: {
          select: {
            name: true,
            portalType: true,
          },
        },
      },
    });
  }

  async countDepartmentsManagedByUser(userId: string): Promise<number> {
    return prisma.departmentManager.count({
      where: { userId },
    });
  }

  async findManager(departmentId: string, userId: string): Promise<DepartmentManagerDto | null> {
    const manager = await prisma.departmentManager.findUnique({
      where: {
        departmentId_userId: { departmentId, userId },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!manager) return null;

    return {
      departmentId: manager.departmentId,
      userId: manager.userId,
      title: manager.title,
      isPrimary: manager.isPrimary,
      createdAt: manager.createdAt,
      user: manager.user,
    };
  }

  async assignManager(
    departmentId: string,
    data: AssignDepartmentManagerDto,
  ): Promise<DepartmentManagerDto> {
    return prisma.$transaction(async (tx) => {
      // If setting this manager as primary, unset other primary managers for this department
      if (data.isPrimary) {
        await tx.departmentManager.updateMany({
          where: { departmentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const manager = await tx.departmentManager.upsert({
        where: {
          departmentId_userId: { departmentId, userId: data.userId },
        },
        create: {
          departmentId,
          userId: data.userId,
          title: data.title ?? null,
          isPrimary: data.isPrimary ?? false,
        },
        update: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return {
        departmentId: manager.departmentId,
        userId: manager.userId,
        title: manager.title,
        isPrimary: manager.isPrimary,
        createdAt: manager.createdAt,
        user: manager.user,
      };
    });
  }

  async updateManager(
    departmentId: string,
    userId: string,
    data: UpdateDepartmentManagerDto,
  ): Promise<DepartmentManagerDto> {
    return prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.departmentManager.updateMany({
          where: { departmentId, isPrimary: true, NOT: { userId } },
          data: { isPrimary: false },
        });
      }

      const manager = await tx.departmentManager.update({
        where: {
          departmentId_userId: { departmentId, userId },
        },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return {
        departmentId: manager.departmentId,
        userId: manager.userId,
        title: manager.title,
        isPrimary: manager.isPrimary,
        createdAt: manager.createdAt,
        user: manager.user,
      };
    });
  }

  async removeManager(departmentId: string, userId: string): Promise<void> {
    await prisma.departmentManager.delete({
      where: {
        departmentId_userId: { departmentId, userId },
      },
    });
  }

  // ─── Positions ───────────────────────────────────────────────────

  async hasPositionAssociations(id: string): Promise<boolean> {
    const internProfile = await prisma.internshipProfile.findFirst({
      where: { positionId: id, deletedAt: null },
    });
    return !!internProfile;
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
