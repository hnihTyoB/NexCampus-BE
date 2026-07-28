import { StatsRepository } from "./stats.repository";
import {
  AdminStatsResponseDto,
  LeaderStatsResponseDto,
  InternPersonalStatsDto,
} from "./stats.dto";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class StatsService {
  private readonly repository = new StatsRepository();
  private adminStatsCache: CacheEntry<AdminStatsResponseDto> | null = null;
  private leaderStatsCacheMap = new Map<string, CacheEntry<LeaderStatsResponseDto>>();
  private internStatsCacheMap = new Map<string, CacheEntry<InternPersonalStatsDto>>();
  private readonly TTL_MS = 30 * 1000; // 30 seconds cache TTL

  async getAdminStats(): Promise<AdminStatsResponseDto> {
    const now = Date.now();
    if (this.adminStatsCache && this.adminStatsCache.expiresAt > now) {
      return this.adminStatsCache.data;
    }
    const data = await this.repository.getAdminStats();
    this.adminStatsCache = { data, expiresAt: now + this.TTL_MS };
    return data;
  }

  async getLeaderStats(user: UserPayload): Promise<LeaderStatsResponseDto> {
    return this.repository.getLeaderStats(user.id);
  }

  async getInternStats(user: UserPayload): Promise<InternPersonalStatsDto> {
    const now = Date.now();
    const cached = this.internStatsCacheMap.get(user.id);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const data = await this.repository.getInternStats(user.id);
    this.internStatsCacheMap.set(user.id, { data, expiresAt: now + this.TTL_MS });
    return data;
  }
}
