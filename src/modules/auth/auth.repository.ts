import { prisma } from "../../database/prisma.client";

const basicSelect = {
  id: true,
  email: true,
  password: true,
  fullName: true,
  roleId: true,
  isActive: true,
  avatarUrl: true,
  resetPasswordExpires: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
};

const fullSelect = {
  id: true,
  email: true,
  password: true,
  fullName: true,
  roleId: true,
  isActive: true,
  avatarUrl: true,
  resetPasswordExpires: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
  intern: {
    select: {
      id: true,
      phone: true,
      department: true,
      position: true,
      startDate: true,
      duration: true,
      discordUsername: true,
      discordRoleGranted: true,
      status: true,
    },
  },
  notificationSetting: {
    select: {
      id: true,
      webEnabled: true,
      emailEnabled: true,
      discordEnabled: true,
    },
  },
};

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: basicSelect,
    });
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: fullSelect,
    });
  }

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
  ) {
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteRefreshToken(token: string) {
    return prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async updateMe(
    id: string,
    data: { fullName?: string; password?: string; avatarUrl?: string },
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: fullSelect,
    });
  }

  async updateResetToken(
    id: string,
    token: string | null,
    expiresAt: Date | null,
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expiresAt,
      },
    });
  }

  async findByResetToken(token: string) {
    return prisma.user.findUnique({
      where: { resetPasswordToken: token },
      select: basicSelect,
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
      select: basicSelect,
    });
  }
}
