import { LeaderRepository } from "./leader.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  LeaderQueryDto,
  CreateLeaderDto,
  UpdateLeaderDto,
  UpdateMeLeaderDto,
} from "./leader.dto";
import { prisma } from "../../database/prisma.client";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";

export class LeaderService {
  private readonly repository = new LeaderRepository();

  async findAll(query: LeaderQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const leader = await this.repository.findById(id);
    if (!leader) {
      throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
    }
    return leader;
  }

  async create(data: CreateLeaderDto) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { role: true },
    });

    if (!user) {
      throw new AppError("Không tìm thấy người dùng", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.role.name !== "LEADER") {
      throw new AppError(
        "Người dùng không có vai trò LEADER",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const existing = await this.repository.findByUserId(data.userId);
    if (existing) {
      throw new AppError(
        "Người dùng này đã có hồ sơ leader",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (data.phone) {
      await validatePhoneUniqueness(data.phone);
    }

    return this.repository.create(data);
  }

  async update(id: string, data: UpdateLeaderDto) {
    await this.findById(id);
    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { leaderId: id });
    }
    return this.repository.update(id, data);
  }

  async getMe(userId: string) {
    const leader = await this.repository.findByUserId(userId);

    if (!leader) {
      throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
    }

    return leader;
  }

  async updateMe(userId: string, data: UpdateMeLeaderDto) {
    const leader = await this.getMe(userId);

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { leaderId: leader.id });
    }

    return this.repository.update(leader.id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
