import { StatsRepository, statsRepository } from "./stats.repository";
import {
  AdminStatsResponseDto,
  LeaderStatsResponseDto,
  InternStatsResponseDto,
} from "./stats.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

interface AuthUser {
  id: string;
  role: string;
  email?: string;
}

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

export class StatsService {
  private readonly repository: StatsRepository = statsRepository;
  private adminStatsCache: CacheItem<AdminStatsResponseDto> | null = null;
  private leaderStatsCache = new Map<string, CacheItem<LeaderStatsResponseDto>>();
  private internStatsCache = new Map<string, CacheItem<InternStatsResponseDto>>();
  private readonly CACHE_TTL_MS = 30 * 1000; // 30s cache TTL

  /**
   * Lấy thống kê toàn hệ thống cho Admin
   */
  async getAdminStats(): Promise<AdminStatsResponseDto> {
    const now = Date.now();
    if (this.adminStatsCache && this.adminStatsCache.expiresAt > now) {
      return this.adminStatsCache.data;
    }

    const data = await this.repository.getAdminStats();
    this.adminStatsCache = { data, expiresAt: now + this.CACHE_TTL_MS };
    return data;
  }

  /**
   * Lấy thống kê quản lý team cho Leader
   */
  async getLeaderStats(user: AuthUser): Promise<LeaderStatsResponseDto> {
    const now = Date.now();
    const cached = this.leaderStatsCache.get(user.id);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await this.repository.getLeaderStats(user.id);
    this.leaderStatsCache.set(user.id, { data, expiresAt: now + this.CACHE_TTL_MS });
    return data;
  }

  /**
   * Lấy thống kê cá nhân cho Thực tập sinh
   */
  async getInternStats(user: AuthUser, requestedInternId?: string): Promise<InternStatsResponseDto> {
    let targetInternId: string;

    if (user.role === "INTERN") {
      const selfInternId = await this.repository.findInternIdByUserId(user.id);
      if (!selfInternId) {
        throw new AppError("Intern profile not found for user", 404, ERROR_CODE.NOT_FOUND);
      }
      targetInternId = selfInternId;
    } else {
      // Leader hoặc Admin có thể xem TTS cụ thể
      if (!requestedInternId) {
        throw new AppError("internId query parameter is required for Leader or Admin", 400, ERROR_CODE.VALIDATION_ERROR);
      }
      targetInternId = requestedInternId;
    }

    const now = Date.now();
    const cached = this.internStatsCache.get(targetInternId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await this.repository.getInternStats(targetInternId);
    this.internStatsCache.set(targetInternId, { data, expiresAt: now + this.CACHE_TTL_MS });
    return data;
  }

  /**
   * Xóa bộ đệm (invalidation helper)
   */
  clearCache(): void {
    this.adminStatsCache = null;
    this.leaderStatsCache.clear();
    this.internStatsCache.clear();
  }
}

export const statsService = new StatsService();
