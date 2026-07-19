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

export class StatsService {
  private readonly repository = new StatsRepository();

  async getAdminStats(): Promise<AdminStatsResponseDto> {
    return this.repository.getAdminStats();
  }

  async getLeaderStats(user: UserPayload): Promise<LeaderStatsResponseDto> {
    return this.repository.getLeaderStats(user.id);
  }

  async getInternStats(user: UserPayload): Promise<InternPersonalStatsDto> {
    return this.repository.getInternStats(user.id);
  }
}
