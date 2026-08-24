import { SystemConfigRepository, systemConfigRepository } from './system-config.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigQueryDto,
  ToggleFeatureFlagDto,
} from './system-config.dto';
import {
  DEFAULT_SYSTEM_CONFIGS,
  SYSTEM_CONFIG_CATEGORY,
  SYSTEM_CONFIG_PUBSUB_CHANNEL,
} from '../../common/constants/system-config.constant';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { envConfig } from '../../config/env.config';
import { sseManagerService } from '../../common/services/sse-manager.service';
import IORedis from 'ioredis';


interface CacheEntry {
  value: unknown;
  isPublic: boolean;
  category: string;
  expiresAt: number;
}

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.env.npm_lifecycle_event === 'test';

export class SystemConfigService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes cache
  private redisPublisher?: IORedis;
  private redisSubscriber?: IORedis;
  private isRedisAvailable = false;

  constructor(private readonly repository: SystemConfigRepository = systemConfigRepository) {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.initRedisPubSub();
    }
  }

  private initRedisPubSub(): void {
    try {
      const redisOptions = {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 500);
        },
      };

      this.redisPublisher = new IORedis(redisOptions);
      this.redisSubscriber = new IORedis(redisOptions);

      this.redisSubscriber.on('connect', () => {
        this.isRedisAvailable = true;
        this.redisSubscriber?.subscribe(SYSTEM_CONFIG_PUBSUB_CHANNEL, (err) => {
          if (err) {
            console.error('[SystemConfigService] Redis subscribe error:', err.message);
          }
        });
      });

      this.redisSubscriber.on('message', (channel, message) => {
        if (channel === SYSTEM_CONFIG_PUBSUB_CHANNEL) {
          try {
            const data = JSON.parse(message);
            if (data?.key) {
              this.cache.delete(data.key);
            } else {
              this.cache.clear();
            }
          } catch {
            this.cache.clear();
          }
        }
      });

      this.redisPublisher.on('error', () => {
        this.isRedisAvailable = false;
      });

      this.redisSubscriber.on('error', () => {
        this.isRedisAvailable = false;
      });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Seed/Đảm bảo các cấu hình và feature flags mặc định tồn tại trong cơ sở dữ liệu.
   */
  async ensureDefaultConfigs(): Promise<void> {
    for (const item of DEFAULT_SYSTEM_CONFIGS) {
      const existing = await this.repository.findByKey(item.key);
      if (!existing) {
        await this.repository.create({
          key: item.key,
          value: item.value,
          description: item.description,
          category: item.category,
          isPublic: item.isPublic,
        });
      }
    }
  }

  /**
   * Lấy giá trị cấu hình theo key (có cache).
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as T;
    }

    const config = await this.repository.findByKey(key);
    if (!config) {
      if (defaultValue !== undefined) return defaultValue;
      throw new AppError(`System configuration '${key}' not found`, 404, ERROR_CODE.NOT_FOUND);
    }

    this.cache.set(key, {
      value: config.value,
      isPublic: config.isPublic,
      category: config.category,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return config.value as T;
  }

  /**
   * Kiểm tra trạng thái Feature Flag (boolean).
   */
  async isFeatureEnabled(flagKey: string, defaultState = true): Promise<boolean> {
    try {
      const val = await this.get<boolean>(flagKey, defaultState);
      return Boolean(val);
    } catch {
      return defaultState;
    }
  }

  /**
   * Lấy toàn bộ các cấu hình công khai (dành cho client/frontend).
   */
  async getPublicConfigs(): Promise<Record<string, unknown>> {
    const publicConfigs = await this.repository.findPublicConfigs();
    const result: Record<string, unknown> = {};
    for (const c of publicConfigs) {
      result[c.key] = c.value;
    }
    return result;
  }

  /**
   * Lấy danh sách cấu hình theo bộ lọc (dành cho Admin).
   */
  async findAll(query: SystemConfigQueryDto) {
    return this.repository.findAll(query);
  }

  /**
   * Tạo mới một cấu hình hoặc feature flag.
   */
  async create(
    data: CreateSystemConfigDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findByKey(data.key);
    if (existing) {
      throw new AppError(`Configuration key '${data.key}' already exists`, 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const created = await this.repository.create(data);
    this.invalidateCache(data.key);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.CREATE_SYSTEM_CONFIG,
      targetType: AUDIT_TARGET_TYPE.SYSTEM_CONFIG,
      targetId: created.id,
      details: { key: created.key, category: created.category, isPublic: created.isPublic },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return created;
  }

  /**
   * Cập nhật cấu hình hoặc feature flag.
   */
  async update(
    key: string,
    data: UpdateSystemConfigDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new AppError(`Configuration key '${key}' not found`, 404, ERROR_CODE.NOT_FOUND);
    }

    const updated = await this.repository.update(key, data);
    this.invalidateCache(key);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.UPDATE_SYSTEM_CONFIG,
      targetType: AUDIT_TARGET_TYPE.SYSTEM_CONFIG,
      targetId: updated.id,
      details: {
        key,
        previous: { value: existing.value, category: existing.category, isPublic: existing.isPublic },
        updated: data,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  }

  /**
   * Bật/tắt nhanh một Feature Flag.
   */
  async toggleFeatureFlag(
    key: string,
    data: ToggleFeatureFlagDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findByKey(key);

    let record = existing;
    if (!record) {
      // Tự động tạo nếu flag chưa có trong DB
      record = await this.repository.create({
        key,
        value: data.enabled,
        description: data.description || 'Feature Flag',
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: false,
      });
    } else {
      record = await this.repository.update(key, {
        value: data.enabled,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        description: data.description ?? record.description ?? undefined,
      });
    }

    this.invalidateCache(key);

    // Broadcast SSE event
    sseManagerService.broadcast({
      type: 'system:feature_toggle',
      data: { key, enabled: data.enabled },
    });

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.TOGGLE_FEATURE_FLAG,
      targetType: AUDIT_TARGET_TYPE.SYSTEM_CONFIG,
      targetId: record.id,
      details: { key, enabled: data.enabled },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });


    return record;
  }

  /**
   * Xóa cấu hình.
   */
  async delete(
    key: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new AppError(`Configuration key '${key}' not found`, 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.delete(key);
    this.invalidateCache(key);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.DELETE_SYSTEM_CONFIG,
      targetType: AUDIT_TARGET_TYPE.SYSTEM_CONFIG,
      targetId: existing.id,
      details: { key },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  /**
   * Xóa cache cục bộ và broadcast tới Redis cluster.
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }

    if (this.isRedisAvailable && this.redisPublisher) {
      this.redisPublisher
        .publish(
          SYSTEM_CONFIG_PUBSUB_CHANNEL,
          JSON.stringify({ key, timestamp: Date.now() }),
        )
        .catch(() => {});
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async close(): Promise<void> {
    this.cache.clear();
    if (this.redisSubscriber) {
      this.redisSubscriber.disconnect();
      this.redisSubscriber = undefined;
    }
    if (this.redisPublisher) {
      this.redisPublisher.disconnect();
      this.redisPublisher = undefined;
    }
  }
}

export const systemConfigService = new SystemConfigService();
