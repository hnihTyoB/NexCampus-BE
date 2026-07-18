import { RegulationRepository } from "./regulation.repository";
import { CreateRegulationDto, UpdateRegulationDto } from "./regulation.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

export class RegulationService {
  private readonly repository = new RegulationRepository();
  private readonly activityLogService = new ActivityLogService();

  async create(data: CreateRegulationDto, actorId: string) {
    const regulation = await this.repository.create(data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_REGULATION,
      `Quản trị viên đã tạo quy định mới "${data.title}" (phiên bản ${regulation.version})`,
      regulation.id,
      "Regulation"
    );

    // If marked active at creation, we need to deactivate others
    if (data.isActive) {
      await this.repository.setActive(regulation.id);
      regulation.isActive = true;
    }

    return regulation;
  }

  async findAll(query: { page?: number; limit?: number; title?: string; isActive?: boolean }) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const regulation = await this.repository.findById(id);
    if (!regulation) {
      throw new AppError("Regulation not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return regulation;
  }

  async findActive() {
    const regulation = await this.repository.findActive();
    if (!regulation) {
      throw new AppError("No active regulation found", 404, ERROR_CODE.NOT_FOUND);
    }
    return regulation;
  }

  async update(id: string, data: UpdateRegulationDto, actorId: string) {
    await this.findById(id); // Throws if not found

    const regulation = await this.repository.update(id, data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_REGULATION,
      `Quản trị viên đã cập nhật quy định "${regulation.title}" (phiên bản ${regulation.version})`,
      regulation.id,
      "Regulation"
    );

    // If updated to active, deactivate others
    if (data.isActive) {
      await this.repository.setActive(id);
      regulation.isActive = true;
    }

    return regulation;
  }

  async delete(id: string, actorId: string) {
    const regulation = await this.findById(id); // Throws if not found

    if (regulation.isActive) {
      throw new AppError("Cannot delete an active regulation. Please activate another regulation first.", 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const isUsed = await this.repository.isUsed(id);
    if (isUsed) {
      throw new AppError("Cannot delete this regulation because it is already accepted by interns.", 400, ERROR_CODE.VALIDATION_ERROR);
    }

    await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_REGULATION,
      `Quản trị viên đã xóa quy định "${regulation.title}"`,
      id,
      "Regulation"
    );

    return regulation;
  }

  async activate(id: string, actorId: string) {
    const regulation = await this.findById(id); // Throws if not found

    if (regulation.isActive) {
      return regulation;
    }

    const updated = await this.repository.setActive(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.ACTIVATE_REGULATION,
      `Quản trị viên đã kích hoạt quy định "${regulation.title}" (phiên bản ${regulation.version})`,
      id,
      "Regulation"
    );

    return updated;
  }
}
