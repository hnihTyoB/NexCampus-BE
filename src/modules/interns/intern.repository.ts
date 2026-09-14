import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  InternQueryDto,
  CreateInternDto,
  DirectCreateInternDto,
  UpdateInternDto,
  InternDto,
} from "./intern.dto";
import { INTERN_STATUS } from "../../common/constants/intern.constant";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  isActive: true,
};

const defaultSelect = {
  id: true,
  userId: true,
  leaderId: true,
  fullName: true,
  phone: true,
  internCode: true,
  university: true,
  major: true,
  departmentId: true,
  positionId: true,
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
} satisfies Prisma.InternSelect;

export class InternRepository {
  async findAll(
    query: InternQueryDto,
    scope?: { departmentIds?: string[]; leaderUserId?: string },
  ): Promise<{
    data: InternDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      search,
      internCode,
      fullName,
      university,
      major,
      departmentId,
      positionId,
      department,
      position,
      status,
      leaderId,
      leader,
      discordRoleGranted,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const andConditions: Prisma.InternWhereInput[] = [{ deletedAt: null }];

    // Scoped access for Leader: Only view interns in managed departments OR directly supervised
    if (scope) {
      const scopeOr: Prisma.InternWhereInput[] = [];
      if (scope.departmentIds && scope.departmentIds.length > 0) {
        scopeOr.push({ departmentId: { in: scope.departmentIds } });
      }
      if (scope.leaderUserId) {
        scopeOr.push({ leaderId: scope.leaderUserId });
      }
      if (scopeOr.length > 0) {
        andConditions.push({ OR: scopeOr });
      } else {
        // Leader has no departments and no assigned interns
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 1 },
        };
      }
    }

    if (search) {
      andConditions.push({
        OR: [
          { internCode: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { university: { contains: search, mode: "insensitive" } },
          { major: { contains: search, mode: "insensitive" } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (internCode) {
      andConditions.push({
        internCode: { contains: internCode, mode: "insensitive" },
      });
    }

    if (fullName) {
      andConditions.push({
        OR: [
          { fullName: { contains: fullName, mode: "insensitive" } },
          { user: { email: { contains: fullName, mode: "insensitive" } } },
        ],
      });
    }

    if (university) {
      andConditions.push({
        university: { contains: university, mode: "insensitive" },
      });
    }

    if (major) {
      andConditions.push({
        major: { contains: major, mode: "insensitive" },
      });
    }

    if (departmentId) {
      andConditions.push({ departmentId });
    }

    if (positionId) {
      andConditions.push({ positionId });
    }

    if (department) {
      andConditions.push({
        department: {
          name: { contains: department, mode: "insensitive" },
        },
      });
    }

    if (position) {
      andConditions.push({
        position: {
          name: { contains: position, mode: "insensitive" },
        },
      });
    }

    if (status) {
      andConditions.push({ status });
    }

    if (leaderId) {
      andConditions.push({ leaderId });
    }

    if (leader) {
      andConditions.push({
        leader: {
          OR: [
            { fullName: { contains: leader, mode: "insensitive" } },
            { email: { contains: leader, mode: "insensitive" } },
          ],
        },
      });
    }

    if (discordRoleGranted !== undefined) {
      andConditions.push({ discordRoleGranted });
    }

    if (startDateFrom || startDateTo) {
      andConditions.push({
        startDate: {
          ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
          ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
        },
      });
    }

    const where: Prisma.InternWhereInput = { AND: andConditions };
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  findById(id: string): Promise<InternDto | null> {
    return prisma.intern.findFirst({
      where: { id, deletedAt: null },
      select: defaultSelect,
    });
  }

  findByUserId(userId: string): Promise<InternDto | null> {
    return prisma.intern.findFirst({
      where: { userId, deletedAt: null },
      select: defaultSelect,
    });
  }

  findActiveByEmail(email: string) {
    return prisma.intern.findFirst({
      where: {
        deletedAt: null,
        status: INTERN_STATUS.ACTIVE,
        user: {
          email: { equals: email, mode: "insensitive" },
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        leaderId: true,
        fullName: true,
        user: { select: { email: true } },
        leader: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  // Lazy auto-complete: chuyển ACTIVE → COMPLETED nếu đã hết thời gian thực tập
  async completeExpiredInterns(): Promise<void> {
    const expiredInterns = await prisma.intern.findMany({
      where: { status: INTERN_STATUS.ACTIVE, deletedAt: null },
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
        data: { status: INTERN_STATUS.COMPLETED },
      });
    }
  }

  async create(
    data: CreateInternDto,
    codePrefix = "INT",
    defaultDuration = 3,
  ): Promise<InternDto> {
    const intern = await prisma.intern.create({
      data: {
        userId: data.userId,
        leaderId: data.leaderId,
        fullName: data.fullName,
        phone: data.phone,
        departmentId: data.departmentId,
        positionId: data.positionId,
        startDate: new Date(data.startDate),
        duration: data.duration ?? defaultDuration,
        discordUsername: data.discordUsername,
        internCode: data.internCode,
        university: data.university,
        major: data.major,
      },
      select: defaultSelect,
    });

    if (!intern.internCode) {
      const generatedCode = `${codePrefix}-${intern.id.substring(0, 8).toUpperCase()}`;
      return prisma.intern.update({
        where: { id: intern.id },
        data: { internCode: generatedCode },
        select: defaultSelect,
      });
    }

    return intern;
  }

  async createWithUser(
    data: DirectCreateInternDto,
    account: { email: string; passwordHash: string; roleId: string },
    codePrefix = "INT",
    defaultDuration = 3,
  ): Promise<InternDto> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: account.email,
          password: account.passwordHash,
          fullName: data.fullName,
          roleId: account.roleId,
          isActive: true,
        },
      });

      const intern = await tx.intern.create({
        data: {
          userId: user.id,
          leaderId: data.leaderId,
          fullName: data.fullName,
          phone: data.phone,
          departmentId: data.departmentId,
          positionId: data.positionId,
          startDate: new Date(data.startDate),
          duration: data.duration ?? defaultDuration,
          discordUsername: data.discordUsername,
          internCode: data.internCode,
          university: data.university,
          major: data.major,
        },
        select: defaultSelect,
      });

      if (!intern.internCode) {
        const generatedCode = `${codePrefix}-${intern.id.substring(0, 8).toUpperCase()}`;
        return tx.intern.update({
          where: { id: intern.id },
          data: { internCode: generatedCode },
          select: defaultSelect,
        });
      }

      return intern;
    });
  }

  update(id: string, data: UpdateInternDto): Promise<InternDto> {
    return prisma.intern.update({
      where: { id },
      data: {
        ...(data.leaderId !== undefined ? { leaderId: data.leaderId } : {}),
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.positionId !== undefined
          ? { positionId: data.positionId }
          : {}),
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
        ...(data.internCode !== undefined
          ? { internCode: data.internCode }
          : {}),
        ...(data.university !== undefined
          ? { university: data.university }
          : {}),
        ...(data.major !== undefined ? { major: data.major } : {}),
      },
      select: defaultSelect,
    });
  }

  softDelete(id: string): Promise<InternDto> {
    return prisma.intern.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: defaultSelect,
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
