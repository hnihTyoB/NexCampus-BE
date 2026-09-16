import IORedis from "ioredis";
import { StatsRepository, statsRepository } from "./stats.repository";
import {
  AdminStatsResponseDto,
  LeaderStatsResponseDto,
  InternStatsResponseDto,
} from "./stats.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { envConfig } from "../../config/env.config";
import { getRedisConnectionOptions } from "../../config/redis.config";
import { ROLES } from "../../common/constants/role.constant";

interface AuthUser {
  id: string;
  role: string;
  email?: string;
}

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

export class StatsService {
  private readonly repository: StatsRepository = statsRepository;
  private adminStatsCache: CacheItem<AdminStatsResponseDto> | null = null;
  private leaderStatsCache = new Map<string, CacheItem<LeaderStatsResponseDto>>();
  private internStatsCache = new Map<string, CacheItem<InternStatsResponseDto>>();
  private readonly CACHE_TTL_SECONDS = 30; // 30s cache TTL
  private readonly CACHE_TTL_MS = 30 * 1000;
  private redisClient?: IORedis;
  private isRedisAvailable = false;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      try {
        const options = getRedisConnectionOptions();
        this.redisClient = new IORedis(options);
        this.redisClient.on("connect", () => {
          this.isRedisAvailable = true;
        });
        this.redisClient.on("error", () => {
          this.isRedisAvailable = false;
        });
        this.redisClient.connect().catch(() => {
          this.isRedisAvailable = false;
        });
      } catch {
        this.isRedisAvailable = false;
      }
    }
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.isRedisAvailable || !this.redisClient) return null;
    try {
      const data = await this.redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch {
      this.isRedisAvailable = false;
    }
    return null;
  }

  private async setInRedis(key: string, value: unknown): Promise<void> {
    if (!this.isRedisAvailable || !this.redisClient) return;
    try {
      await this.redisClient.setex(
        key,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Lấy thống kê toàn hệ thống cho Admin
   */
  async getAdminStats(): Promise<AdminStatsResponseDto> {
    const redisKey = "stats:admin";
    const redisCached = await this.getFromRedis<AdminStatsResponseDto>(redisKey);
    if (redisCached) {
      return redisCached;
    }

    const now = Date.now();
    if (this.adminStatsCache && this.adminStatsCache.expiresAt > now) {
      return this.adminStatsCache.data;
    }

    const data = await this.repository.getAdminStats();
    this.adminStatsCache = { data, expiresAt: now + this.CACHE_TTL_MS };
    await this.setInRedis(redisKey, data);
    return data;
  }

  /**
   * Lấy thống kê quản lý team cho Leader
   */
  async getLeaderStats(user: AuthUser): Promise<LeaderStatsResponseDto> {
    const redisKey = `stats:leader:${user.id}`;
    const redisCached = await this.getFromRedis<LeaderStatsResponseDto>(redisKey);
    if (redisCached) {
      return redisCached;
    }

    const now = Date.now();
    const cached = this.leaderStatsCache.get(user.id);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await this.repository.getLeaderStats(user.id);
    this.leaderStatsCache.set(user.id, { data, expiresAt: now + this.CACHE_TTL_MS });
    await this.setInRedis(redisKey, data);
    return data;
  }

  /**
   * Lấy thống kê cá nhân cho Thực tập sinh
   * SEC-01: INTERN chỉ thấy thống kê của chính mình.
   *         LEADER chỉ thấy thống kê intern thuộc quyền quản lý của mình.
   *         ADMIN thấy tất cả.
   */
  async getInternStats(user: AuthUser, requestedInternId?: string): Promise<InternStatsResponseDto> {
    let targetInternId: string;

    if (user.role === ROLES.INTERN) {
      // Intern chỉ được xem thống kê của chính mình — bỏ qua internId query param
      const selfInternId = await this.repository.findInternIdByUserId(user.id);
      if (!selfInternId) {
        throw new AppError("Intern profile not found for user", 404, ERROR_CODE.NOT_FOUND);
      }
      targetInternId = selfInternId;
    } else if (user.role === ROLES.LEADER) {
      // Leader phải cung cấp internId và intern đó phải thuộc quyền quản lý
      if (!requestedInternId) {
        throw new AppError("internId query parameter is required for Leader", 400, ERROR_CODE.VALIDATION_ERROR);
      }
      const isManaged = await this.repository.isInternManagedByLeader(requestedInternId, user.id);
      if (!isManaged) {
        throw new AppError(
          "Không có quyền xem thống kê của thực tập sinh này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
      targetInternId = requestedInternId;
    } else {
      // ADMIN: xem tất cả
      if (!requestedInternId) {
        throw new AppError("internId query parameter is required for Admin", 400, ERROR_CODE.VALIDATION_ERROR);
      }
      targetInternId = requestedInternId;
    }

    const redisKey = `stats:intern:${targetInternId}`;
    const redisCached = await this.getFromRedis<InternStatsResponseDto>(redisKey);
    if (redisCached) {
      return redisCached;
    }

    const now = Date.now();
    const cached = this.internStatsCache.get(targetInternId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await this.repository.getInternStats(targetInternId);
    this.internStatsCache.set(targetInternId, { data, expiresAt: now + this.CACHE_TTL_MS });
    await this.setInRedis(redisKey, data);
    return data;
  }

  /**
   * Xóa bộ đệm (invalidation helper)
   */
  clearCache(): void {
    this.adminStatsCache = null;
    this.leaderStatsCache.clear();
    this.internStatsCache.clear();
    if (this.isRedisAvailable && this.redisClient) {
      this.redisClient.del("stats:admin").catch(() => {});
    }
  }
}

export const statsService = new StatsService();
