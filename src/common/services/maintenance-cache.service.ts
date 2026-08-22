import { MaintenanceConfig } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { DEFAULT_MAINTENANCE_CONFIG } from '../constants/maintenance.constant';

interface CacheEntry {
  config: MaintenanceConfig;
  expiresAt: number;
}

export class MaintenanceCacheService {
  private cache: CacheEntry | null = null;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  async getConfig(key = 'DEFAULT'): Promise<MaintenanceConfig> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.config;
    }

    let config = await prisma.maintenanceConfig.findUnique({
      where: { key },
    });

    if (!config) {
      // Upsert default config if not yet in database
      config = await prisma.maintenanceConfig.upsert({
        where: { key },
        update: {},
        create: {
          key: DEFAULT_MAINTENANCE_CONFIG.key,
          enabled: DEFAULT_MAINTENANCE_CONFIG.enabled,
          status: DEFAULT_MAINTENANCE_CONFIG.status,
          title: DEFAULT_MAINTENANCE_CONFIG.title,
          message: DEFAULT_MAINTENANCE_CONFIG.message,
          bypassPermissions: DEFAULT_MAINTENANCE_CONFIG.bypassPermissions as any,
          bypassRoles: DEFAULT_MAINTENANCE_CONFIG.bypassRoles as any,
        },
      });
    }

    this.cache = {
      config,
      expiresAt: now + this.TTL_MS,
    };

    return config;
  }

  set(config: MaintenanceConfig): void {
    this.cache = {
      config,
      expiresAt: Date.now() + this.TTL_MS,
    };
  }

  invalidate(): void {
    this.cache = null;
  }

  clear(): void {
    this.cache = null;
  }
}

export const maintenanceCacheService = new MaintenanceCacheService();
