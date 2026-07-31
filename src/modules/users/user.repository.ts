import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { UserQueryDto } from "./user.dto";
const defaultSelect = {
  id: true,
  email: true,
  fullName: true,
  roleId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  avatarUrl: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
};

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
      ...(email ? { email: { equals: email, mode: "insensitive" } } : {}),
      ...(fullName
        ? { fullName: { contains: fullName, mode: "insensitive" } }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(roleName ? { role: { name: roleName } } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
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

  findRoleByName(name: string) {
    return prisma.role.findUnique({
      where: { name },
    });
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: defaultSelect,
    });
  }

  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: defaultSelect,
    });
  }

  create(data: { email: string; passwordHash: string; roleId: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        roleId: data.roleId,
      },
      select: defaultSelect,
    });
  }

  update(
    id: string,
    data: { isActive?: boolean; roleId?: string; avatarUrl?: string | null },
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: defaultSelect,
    });
  }

  async delete(id: string, deletedBy: string) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedBy,
        },
        select: defaultSelect,
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: id },
      }),
    ]);
    return user;
  }

  /**
   * Tìm người dùng đã bị xóa mềm qua retentionDays ngày và vẫn còn avatarUrl.
   */
  findOrphanedAvatars(retentionDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    return prisma.user.findMany({
      where: {
        deletedAt: {
          not: null,
          lte: cutoff,
        },
        avatarUrl: {
          not: null,
          notIn: [""],
        },
      },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
  }

  clearAvatarUrls(ids: string[]) {
    return prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { avatarUrl: null },
    });
  }
}
