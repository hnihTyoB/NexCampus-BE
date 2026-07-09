import { prisma } from "../../database/prisma.client";

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true },
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
      include: { role: true },
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
      include: { role: true },
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
      include: { role: true },
    });
  }
}
