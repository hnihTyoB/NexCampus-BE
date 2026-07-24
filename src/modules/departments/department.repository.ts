import { prisma } from "../../database/prisma.client";
import { CreateDepartmentDto, UpdateDepartmentDto, CreatePositionDto, UpdatePositionDto } from "./department.dto";

const positionSelect = { id: true, departmentId: true, name: true };

const departmentWithPositions = {
  id: true,
  name: true,
  positions: { select: { id: true, name: true } },
};

export class DepartmentRepository {
  // ─── Departments ─────────────────────────────────────────────────

  findAll() {
    return prisma.department.findMany({
      select: departmentWithPositions,
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.department.findUnique({
      where: { id },
      select: departmentWithPositions,
    });
  }

  create(data: CreateDepartmentDto) {
    const hasPositions = data.positions && data.positions.length > 0;
    return prisma.department.create({
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
  }

  update(id: string, data: UpdateDepartmentDto) {
    return prisma.department.update({
      where: { id },
      data,
      select: departmentWithPositions,
    });
  }

  async hasAssociations(id: string): Promise<boolean> {
    const [intern, leader, app] = await Promise.all([
      prisma.intern.findFirst({ where: { departmentId: id } }),
      prisma.leader.findFirst({ where: { departmentId: id } }),
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
