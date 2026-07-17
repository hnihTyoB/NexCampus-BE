import { InternRepository } from "./intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { InternQueryDto, CreateInternDto, UpdateInternDto, UpdateMeInternDto } from "./intern.dto";
import { prisma } from "../../database/prisma.client";
import { INTERN_STATUS } from "../../common/constants/status.constant";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";

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
      throw new AppError("Không tìm thấy thực tập sinh", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async create(data: CreateInternDto) {
    const existing = await this.repository.findByUserId(data.userId);

    if (existing) {
      throw new AppError(
        "Người dùng này đã có hồ sơ thực tập sinh",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await validatePhoneUniqueness(data.phone);

    return this.repository.create(data);
  }

  async update(id: string, data: UpdateInternDto) {
    const intern = await this.findById(id);

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { internId: id });
    }

    // If dropping, deactivate user account
    if (data.status === INTERN_STATUS.DROPPED && intern.userId) {
      await prisma.user.update({
        where: { id: intern.userId },
        data: { isActive: false },
      });
    }

    return this.repository.update(id, data);
  }

  async assignLeader(id: string, leaderId: string | null) {
    await this.findById(id);

    if (leaderId) {
      const leaderUser = await prisma.user.findUnique({
        where: { id: leaderId },
        include: { role: true },
      });

      if (!leaderUser) {
        throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
      }

      if (leaderUser.role.name !== "LEADER") {
        throw new AppError(
          "Người dùng được chọn không phải là LEADER",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    return this.repository.update(id, { leaderId });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.softDelete(id);
  }

  async getMe(userId: string) {
    const profile = await this.repository.findByUserId(userId);

    if (!profile) {
      throw new AppError("Không tìm thấy hồ sơ thực tập sinh", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async updateMe(userId: string, data: UpdateMeInternDto) {
    const profile = await this.getMe(userId);

    return this.update(profile.id, data);
  }
}
