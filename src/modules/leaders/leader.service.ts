import { LeaderRepository } from "./leader.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { LeaderQueryDto, CreateLeaderDto, UpdateLeaderDto } from "./leader.dto";

export class LeaderService {
  private readonly repository = new LeaderRepository();

  async findAll(query: LeaderQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const leader = await this.repository.findById(id);
    if (!leader) {
      throw new AppError("Leader not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return leader;
  }

  async create(data: CreateLeaderDto) {
    const existing = await this.repository.findByUserId(data.userId);
    if (existing) {
      throw new AppError(
        "This user already has a leader profile",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateLeaderDto) {
    await this.findById(id);
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
