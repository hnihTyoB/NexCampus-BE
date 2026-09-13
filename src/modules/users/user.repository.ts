import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { ROLES } from "../../common/constants/role.constant";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { UserQueryDto } from "./user.dto";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  phoneNumber: true,
  isActive: true,
  roleId: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export class UserRepository {
  async findAll(query: UserQueryDto) {
    const {
      email,
      fullName,
      roleName,
      isActive,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
      ...(fullName
        ? { fullName: { contains: fullName, mode: "insensitive" } }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(roleName ? { role: { name: roleName } } : {}),
    };

    const skip = (page - 1) * limit;

    const SORT_MAP: Record<string, Prisma.UserOrderByWithRelationInput> = {
      createdAt: { createdAt: order },
      email: { email: order },
      fullName: { fullName: order },
    };
    const orderBy = SORT_MAP[sortBy] ?? { createdAt: order };

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    });
  }

  findUserStateById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        roleId: true,
        role: { select: { name: true } },
      },
    });
  }

  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: userSelect,
    });
  }

  create(data: {
    email?: string;
    passwordHash?: string;
    fullName?: string;
    avatarUrl?: string;
    phoneNumber?: string;
    roleId: string;
    isActive?: boolean;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        phoneNumber: data.phoneNumber,
        roleId: data.roleId,
        isActive: data.isActive,
      },
      select: userSelect,
    });
  }

  update(
    id: string,
    data: { isActive?: boolean; fullName?: string; phoneNumber?: string },
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  /**
   * Đếm số lượng người dùng đang hoạt động theo vai trò bất kỳ.
   */
  async countActiveUsersByRole(roleName: string): Promise<number> {
    return prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        role: {
          name: roleName,
        },
      },
    });
  }

  /**
   * Đếm số lượng người dùng đang hoạt động có đặc quyền quản trị hệ thống:
   * 1. Vai trò khớp với roleName (mặc định ROLES.ADMIN)
   * 2. Hoặc vai trò sở hữu các quyền quản trị then chốt (USER_ROLE_ASSIGN, ROLE_PERMISSION_ASSIGN)
   */
  async countActiveAdmins(roleName: string = ROLES.ADMIN): Promise<number> {
    return prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { role: { name: roleName } },
          {
            role: {
              permissions: {
                some: {
                  permission: {
                    name: {
                      in: [
                        PERMISSIONS.USER_ROLE_ASSIGN,
                        PERMISSIONS.ROLE_PERMISSION_ASSIGN,
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
  }

  async softDelete(id: string, adminId: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: adminId,
          isActive: false,
        },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: id },
      }),
    ]);
  }

  // ────── Session Management ──────

  findSessionsByUserId(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findSessionById(userId: string, sessionId: string) {
    return prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
  }

  deleteSessionById(userId: string, sessionId: string) {
    return prisma.refreshToken.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  deleteAllSessionsByUserId(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  // ────── Device Management ──────

  findDevicesByUserId(userId: string) {
    return prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastLoginAt: "desc" },
    });
  }

  findDeviceById(userId: string, deviceId: string) {
    return prisma.userDevice.findFirst({
      where: { id: deviceId, userId },
    });
  }

  deleteDeviceById(userId: string, deviceId: string) {
    return prisma.userDevice.deleteMany({
      where: { id: deviceId, userId },
    });
  }

  // ────── Audit Log ──────

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId ?? "SYSTEM", // AuditLog.targetId is required String in schema
        details: data.details as any,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const userRepository = new UserRepository();
