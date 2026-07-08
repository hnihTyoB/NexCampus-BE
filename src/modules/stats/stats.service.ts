import { StatsRepository } from "./stats.repository";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class StatsService {
  private readonly repository = new StatsRepository();

  async getAdminStats() {
    return this.repository.getAdminStats();
  }

  async getLeaderStats(user: UserPayload) {
    return this.repository.getLeaderStats(user.id);
  }
}
