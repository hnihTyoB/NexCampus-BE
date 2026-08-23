import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { DEFAULT_MAINTENANCE_CONFIG } from '../../common/constants/maintenance.constant';

export class MaintenanceRepository {
  async getConfig(key = 'DEFAULT') {
    return prisma.maintenanceConfig.findUnique({
      where: { key },
    });
  }

  async getOrCreateDefaultConfig(key = 'DEFAULT') {
    return prisma.maintenanceConfig.upsert({
      where: { key },
      update: {},
      create: {
        key,
        enabled: DEFAULT_MAINTENANCE_CONFIG.enabled,
        status: DEFAULT_MAINTENANCE_CONFIG.status,
        title: DEFAULT_MAINTENANCE_CONFIG.title,
        message: DEFAULT_MAINTENANCE_CONFIG.message,
        bypassPermissions: DEFAULT_MAINTENANCE_CONFIG.bypassPermissions as any,
        bypassRoles: DEFAULT_MAINTENANCE_CONFIG.bypassRoles as any,
        bypassIps: DEFAULT_MAINTENANCE_CONFIG.bypassIps as any,
      },
    });
  }

  async updateConfig(key: string, data: Prisma.MaintenanceConfigUpdateInput) {
    return prisma.maintenanceConfig.update({
      where: { key },
      data,
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
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

export const maintenanceRepository = new MaintenanceRepository();
