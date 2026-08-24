import { prisma } from '../../database/prisma.client';
import { ActivitySummaryStatsDto } from './cron.dto';

export class CronRepository {
  /**
   * Xóa toàn bộ các bản ghi Audit Logs tạo trước thời điểm cutoffDate
   */
  async deleteAuditLogsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }

  /**
   * Xóa toàn bộ các token xác thực và phiên đã hết hạn
   */
  async deleteExpiredTokens(cutoffDate: Date): Promise<{
    refreshTokensCount: number;
    verificationTokensCount: number;
    passwordResetTokensCount: number;
  }> {
    const [refreshRes, verifyRes, resetRes] = await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      prisma.verificationToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
    ]);

    return {
      refreshTokensCount: refreshRes.count,
      verificationTokensCount: verifyRes.count,
      passwordResetTokensCount: resetRes.count,
    };
  }

  /**
   * Lấy toàn bộ danh sách avatarUrl hiện tại của các User đang lưu trong DB
   */
  async getAllUserAvatarUrls(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        avatarUrl: { not: null },
      },
      select: {
        avatarUrl: true,
      },
    });

    return users
      .map((u) => u.avatarUrl)
      .filter((url): url is string => Boolean(url));
  }

  /**
   * Tổng hợp thống kê hoạt động hệ thống trong khoảng thời gian từ startDate đến endDate
   */
  async getActivityStats(startDate: Date, endDate: Date): Promise<ActivitySummaryStatsDto> {
    const [
      newUsersCount,
      activeSessionsCount,
      notificationsSentCount,
      emailsSentCount,
      webhookDeliveriesCount,
      auditLogsCount,
    ] = await prisma.$transaction([
      prisma.user.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.refreshToken.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.notification.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.emailNotification.count({
        where: {
          status: 'SENT',
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.webhookDelivery.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      newUsersCount,
      activeSessionsCount,
      notificationsSentCount,
      emailsSentCount,
      webhookDeliveriesCount,
      auditLogsCount,
    };
  }

  /**
   * Lấy danh sách email của tất cả người dùng có quyền Quản trị (vai trò ADMIN / SUPER_ADMIN)
   */
  async findAdminUsers(): Promise<Array<{ id: string; email: string; fullName: string | null }>> {
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        email: { not: null },
        role: {
          name: { in: ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    return admins as Array<{ id: string; email: string; fullName: string | null }>;
  }

  /**
   * Tạo bản ghi Audit Log ghi vết thao tác Cron Job
   */
  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const cronRepository = new CronRepository();
