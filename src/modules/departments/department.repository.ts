import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { CreateDepartmentDto, UpdateDepartmentDto, CreatePositionDto, UpdatePositionDto } from "./department.dto";

const positionSelect = { id: true, departmentId: true, name: true };

const departmentWithPositions = {
  id: true,
  name: true,
  positions: { select: { id: true, name: true } },
  leaderAssignments: {
    select: {
      leader: {
        select: {
          id: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DepartmentSelect;

type DepartmentRecord = Prisma.DepartmentGetPayload<{
  select: typeof departmentWithPositions;
}>;

function serializeDepartment(department: DepartmentRecord) {
  const { leaderAssignments, ...data } = department;
  return {
    ...data,
    leaders: leaderAssignments.map((assignment) => assignment.leader),
  };
}

export class DepartmentRepository {
  // ─── Departments ─────────────────────────────────────────────────

  async findAll(departmentIds?: string[], filters?: { name?: string; leader?: string }) {
    const where: Prisma.DepartmentWhereInput = {};
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
      select: departmentWithPositions,
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

  async findById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      select: departmentWithPositions,
    });
    return department ? serializeDepartment(department) : null;
  }

  async create(data: CreateDepartmentDto) {
    const hasPositions = data.positions && data.positions.length > 0;
    const department = await prisma.department.create({
      data: {
        name: data.name,
        positions: hasPositions
          ? {
              create: data.positions!.map((posName) => ({ name: posName })),
            }
          : undefined,
      },
      select: departmentWithPositions,
    });
    return serializeDepartment(department);
  }

  async update(id: string, data: UpdateDepartmentDto) {
    const department = await prisma.department.update({
      where: { id },
      data,
      select: departmentWithPositions,
    });
    return serializeDepartment(department);
  }

  async hasAssociations(id: string): Promise<boolean> {
    const [intern, leader, app] = await Promise.all([
      prisma.intern.findFirst({ where: { departmentId: id } }),
      prisma.leaderDepartment.findFirst({ where: { departmentId: id } }),
      prisma.application.findFirst({ where: { departmentId: id } }),
    ]);
    return !!(intern || leader || app);
  }

  delete(id: string) {
    return prisma.department.delete({ where: { id } });
  }

  // ─── Positions ───────────────────────────────────────────────────

  async hasPositionAssociations(id: string): Promise<boolean> {
    const [intern, app] = await Promise.all([
      prisma.intern.findFirst({ where: { positionId: id } }),
      prisma.application.findFirst({ where: { positionId: id } }),
    ]);
    return !!(intern || app);
  }

  findPositionsByDepartment(departmentId: string) {
    return prisma.position.findMany({
      where: { departmentId },
      select: positionSelect,
      orderBy: { name: "asc" },
    });
  }

  findPositionById(id: string) {
    return prisma.position.findUnique({
      where: { id },
      select: positionSelect,
    });
  }

  createPosition(data: CreatePositionDto) {
    return prisma.position.create({
      data: {
        departmentId: data.departmentId,
        name: data.name,
      },
      select: positionSelect,
    });
  }

  updatePosition(id: string, data: UpdatePositionDto) {
    return prisma.position.update({
      where: { id },
      data,
      select: positionSelect,
    });
  }

  deletePosition(id: string) {
    return prisma.position.delete({ where: { id } });
  }
}
