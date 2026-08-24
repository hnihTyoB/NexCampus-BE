import { maintenanceRepository, MaintenanceRepository } from './maintenance.repository';
import { maintenanceCacheService, MaintenanceCacheService } from '../../common/services/maintenance-cache.service';
import { sseManagerService } from '../../common/services/sse-manager.service';
import { EnableMaintenanceDto, UpdateMaintenanceDto, PublicMaintenanceStatusDto } from './maintenance.dto';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { MAINTENANCE_STATUS, MaintenanceStatus } from '../../common/constants/maintenance.constant';

export class MaintenanceService {
  constructor(
    private repo: MaintenanceRepository = maintenanceRepository,
    private cacheService: MaintenanceCacheService = maintenanceCacheService,
  ) {}

  async getConfig(key = 'DEFAULT') {
    const config = await this.repo.getOrCreateDefaultConfig(key);
    return config;
  }

  async getPublicStatus(key = 'DEFAULT'): Promise<PublicMaintenanceStatusDto> {
    const config = await this.cacheService.getConfig(key);
    return {
      enabled: config.enabled,
      status: config.status as MaintenanceStatus,
      title: config.title,
      message: config.message,
      startAt: config.startAt ? config.startAt.toISOString() : null,
      estimatedEndAt: config.estimatedEndAt ? config.estimatedEndAt.toISOString() : null,
    };
  }

  async enableMaintenance(
    dto: EnableMaintenanceDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const previousConfig = await this.repo.getOrCreateDefaultConfig();

    const startAt = dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : new Date();
    const estimatedEndAt = dto.estimatedEndAt !== undefined ? (dto.estimatedEndAt ? new Date(dto.estimatedEndAt) : null) : previousConfig.estimatedEndAt;

    const newStatus = dto.status || MAINTENANCE_STATUS.MAINTENANCE;

    const updatedConfig = await this.repo.updateConfig(previousConfig.key, {
      enabled: true,
      status: newStatus,
      title: dto.title ?? previousConfig.title,
      message: dto.message ?? previousConfig.message,
      startAt,
      estimatedEndAt,
      bypassPermissions: (dto.bypassPermissions ?? (previousConfig.bypassPermissions as any)) as any,
      bypassRoles: (dto.bypassRoles ?? (previousConfig.bypassRoles as any)) as any,
      bypassIps: (dto.bypassIps ?? (previousConfig.bypassIps as any)) as any,
    });

    this.cacheService.invalidate();

    // Broadcast SSE event
    sseManagerService.broadcast({
      type: 'system:maintenance',
      data: {
        enabled: updatedConfig.enabled,
        status: updatedConfig.status,
        title: updatedConfig.title,
        message: updatedConfig.message,
        startAt: updatedConfig.startAt ? updatedConfig.startAt.toISOString() : null,
        estimatedEndAt: updatedConfig.estimatedEndAt ? updatedConfig.estimatedEndAt.toISOString() : null,
      },
    });


    // Audit log
    await this.repo.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.ENABLE_MAINTENANCE,
      targetType: AUDIT_TARGET_TYPE.MAINTENANCE_CONFIG,
      targetId: updatedConfig.id,
      details: {
        previous: {
          enabled: previousConfig.enabled,
          status: previousConfig.status,
          title: previousConfig.title,
          estimatedEndAt: previousConfig.estimatedEndAt,
        },
        current: {
          enabled: updatedConfig.enabled,
          status: updatedConfig.status,
          title: updatedConfig.title,
          estimatedEndAt: updatedConfig.estimatedEndAt,
        },
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updatedConfig;
  }

  async updateConfig(
    dto: UpdateMaintenanceDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const previousConfig = await this.repo.getOrCreateDefaultConfig();

    let enabled = dto.enabled !== undefined ? dto.enabled : previousConfig.enabled;
    let status = dto.status !== undefined ? dto.status : previousConfig.status;

    if (dto.status === MAINTENANCE_STATUS.ONLINE) {
      enabled = false;
    } else if (dto.status === MAINTENANCE_STATUS.MAINTENANCE || dto.status === MAINTENANCE_STATUS.READ_ONLY) {
      enabled = true;
    } else if (dto.enabled !== undefined) {
      status = dto.enabled ? MAINTENANCE_STATUS.MAINTENANCE : MAINTENANCE_STATUS.ONLINE;
    }

    const startAt = dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : previousConfig.startAt;
    const estimatedEndAt = dto.estimatedEndAt !== undefined ? (dto.estimatedEndAt ? new Date(dto.estimatedEndAt) : null) : previousConfig.estimatedEndAt;

    const updatedConfig = await this.repo.updateConfig(previousConfig.key, {
      enabled,
      status,
      title: dto.title ?? previousConfig.title,
      message: dto.message ?? previousConfig.message,
      startAt,
      estimatedEndAt,
      bypassPermissions: (dto.bypassPermissions ?? (previousConfig.bypassPermissions as any)) as any,
      bypassRoles: (dto.bypassRoles ?? (previousConfig.bypassRoles as any)) as any,
      bypassIps: (dto.bypassIps ?? (previousConfig.bypassIps as any)) as any,
    });

    this.cacheService.invalidate();

    // Broadcast SSE event
    sseManagerService.broadcast({
      type: 'system:maintenance',
      data: {
        enabled: updatedConfig.enabled,
        status: updatedConfig.status,
        title: updatedConfig.title,
        message: updatedConfig.message,
        startAt: updatedConfig.startAt ? updatedConfig.startAt.toISOString() : null,
        estimatedEndAt: updatedConfig.estimatedEndAt ? updatedConfig.estimatedEndAt.toISOString() : null,
      },
    });

    // Audit log
    await this.repo.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.UPDATE_MAINTENANCE,
      targetType: AUDIT_TARGET_TYPE.MAINTENANCE_CONFIG,
      targetId: updatedConfig.id,
      details: {
        previous: {
          enabled: previousConfig.enabled,
          status: previousConfig.status,
          title: previousConfig.title,
          estimatedEndAt: previousConfig.estimatedEndAt,
        },
        current: {
          enabled: updatedConfig.enabled,
          status: updatedConfig.status,
          title: updatedConfig.title,
          estimatedEndAt: updatedConfig.estimatedEndAt,
        },
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updatedConfig;
  }

  async disableMaintenance(
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const previousConfig = await this.repo.getOrCreateDefaultConfig();

    const updatedConfig = await this.repo.updateConfig(previousConfig.key, {
      enabled: false,
      status: MAINTENANCE_STATUS.ONLINE,
    });

    this.cacheService.invalidate();

    // Broadcast SSE event
    sseManagerService.broadcast({
      type: 'system:maintenance',
      data: {
        enabled: false,
        status: MAINTENANCE_STATUS.ONLINE,
        title: updatedConfig.title,
        message: updatedConfig.message,
        startAt: null,
        estimatedEndAt: null,
      },
    });

    // Audit log
    await this.repo.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.DISABLE_MAINTENANCE,
      targetType: AUDIT_TARGET_TYPE.MAINTENANCE_CONFIG,
      targetId: updatedConfig.id,
      details: {
        previous: {
          enabled: previousConfig.enabled,
          status: previousConfig.status,
        },
        current: {
          enabled: false,
          status: MAINTENANCE_STATUS.ONLINE,
        },
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updatedConfig;
  }
}


export const maintenanceService = new MaintenanceService();
