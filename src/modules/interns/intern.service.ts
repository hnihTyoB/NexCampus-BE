import { InternRepository } from "./intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { InternQueryDto, CreateInternDto, UpdateInternDto, UpdateMeInternDto } from "./intern.dto";
import { prisma } from "../../database/prisma.client";
import { INTERN_STATUS } from "../../common/constants/status.constant";

export class InternService {
  private readonly repository = new InternRepository();

  async findAll(query: InternQueryDto) {
    await this.repository.completeExpiredInterns();
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    await this.repository.completeExpiredInterns();
    const profile = await this.repository.findById(id);

    if (!profile) {
      throw new AppError("Intern not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async create(data: CreateInternDto) {
    const existing = await this.repository.findByUserId(data.userId);

    if (existing) {
      throw new AppError(
        "This user already has an intern profile",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.create(data);
  }

  async update(id: string, data: UpdateInternDto) {
    const intern = await this.findById(id);

    // If dropping, deactivate user account
    if (data.status === INTERN_STATUS.DROPPED && intern.userId) {
      await prisma.user.update({
        where: { id: intern.userId },
        data: { isActive: false },
      });
    }

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.softDelete(id);
  }

  async getMe(userId: string) {
    const profile = await this.repository.findByUserId(userId);

    if (!profile) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async updateMe(userId: string, data: UpdateMeInternDto) {
    const profile = await this.getMe(userId);

    return this.repository.update(profile.id, data);
  }
}
