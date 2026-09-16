import {
  RegulationRepository,
  regulationRepository,
} from "./regulation.repository";
import {
  CreateRegulationDto,
  UpdateRegulationDto,
  RegulationQueryDto,
} from "./regulation.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class RegulationService {
  private readonly repository: RegulationRepository = regulationRepository;

  async create(data: CreateRegulationDto, actorId: string) {
    const regulation = await this.repository.create(data);

    if (data.isActive) {
      await this.repository.setActive(regulation.id);
      regulation.isActive = true;
    }

    return regulation;
  }

  async findAll(query: RegulationQueryDto, userId?: string, userRole?: string) {
    let internId: string | undefined = undefined;
    if (userRole === "INTERN" && userId) {
      internId = (await this.repository.findInternIdByUserId(userId)) || undefined;
    }

    return this.repository.findAll(query, internId);
  }

  async findById(id: string, userId?: string, userRole?: string) {
    let internId: string | undefined = undefined;
    if (userRole === "INTERN" && userId) {
      internId = (await this.repository.findInternIdByUserId(userId)) || undefined;
    }

    const regulation = await this.repository.findById(id, internId);
    if (!regulation) {
      throw new AppError("Regulation not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return regulation;
  }

  async findActive(userId?: string, userRole?: string) {
    let internId: string | undefined = undefined;
    if (userRole === "INTERN" && userId) {
      internId = (await this.repository.findInternIdByUserId(userId)) || undefined;
    }

    const regulation = await this.repository.findActive(internId);
    if (!regulation) {
      throw new AppError("No active regulation found", 404, ERROR_CODE.NOT_FOUND);
    }
    return regulation;
  }

  async update(id: string, data: UpdateRegulationDto, actorId: string) {
    await this.findById(id); // Throws if not found

    const regulation = await this.repository.update(id, data);

    if (data.isActive) {
      await this.repository.setActive(id);
      regulation.isActive = true;
    }

    return regulation;
  }

  async delete(id: string, actorId: string) {
    const regulation = await this.findById(id);

    if (regulation.isActive) {
      throw new AppError(
        "Cannot delete an active regulation. Please activate another regulation first.",
        400,
        ERROR_CODE.VALIDATION_ERROR
      );
    }

    const isUsed = await this.repository.isUsed(id);
    if (isUsed) {
      throw new AppError(
        "Cannot delete this regulation because it is already accepted by interns or referenced in applications.",
        400,
        ERROR_CODE.VALIDATION_ERROR
      );
    }

    await this.repository.delete(id);
    return regulation;
  }

  async activate(id: string, actorId: string) {
    const regulation = await this.findById(id);

    if (regulation.isActive) {
      return regulation;
    }

    return this.repository.setActive(id);
  }

  async acknowledge(
    regulationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const regulation = await this.findById(regulationId);

    const internId = await this.repository.findInternIdByUserId(userId);
    if (!internId) {
      throw new AppError(
        "Chỉ thực tập sinh (Intern) mới có thể xác nhận tuân thủ nội quy",
        403,
        ERROR_CODE.FORBIDDEN
      );
    }

    const ack = await this.repository.acknowledge(
      regulationId,
      internId,
      ipAddress,
      userAgent
    );

    return {
      success: true,
      message: "Xác nhận đã đọc và cam kết tuân thủ nội quy thành công",
      data: {
        regulationId,
        regulationTitle: regulation.title,
        version: regulation.version,
        acknowledgedAt: ack.acknowledgedAt,
      },
    };
  }
}

export const regulationService = new RegulationService();
