import { AbsenceRepository } from "./absence.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  AbsenceQueryDto,
  CreateAbsenceDto,
  ReviewAbsenceDto,
} from "./absence.dto";
import { ROLES } from "../../common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { AbsenceStatus } from "@prisma/client";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class AbsenceService {
  private readonly repository = new AbsenceRepository();

  async findAll(query: AbsenceQueryDto, actor: UserPayload) {
    let scope: { userId?: string; leaderUserId?: string } | undefined;

    if (actor.role === ROLES.INTERN) {
      scope = { userId: actor.id };
    } else if (actor.role === ROLES.LEADER) {
      scope = { leaderUserId: actor.id };
    }

    return this.repository.findAll(query, scope);
  }

  async findById(id: string, actor: UserPayload) {
    const absence = await this.repository.findById(id);
    if (!absence) {
      throw new AppError("Đơn xin vắng mặt không tồn tại", 404, ERROR_CODE.ABSENCE_NOT_FOUND);
    }

    if (actor.role === ROLES.INTERN && absence.userId !== actor.id) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    if (
      actor.role === ROLES.LEADER &&
      absence.user?.intern?.leaderId !== actor.id
    ) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    return absence;
  }

  async create(
    data: CreateAbsenceDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      throw new AppError(
        "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
        400,
        ERROR_CODE.INVALID_DATE_RANGE,
      );
    }

    const absence = await this.repository.create(data, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_GENERAL_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE,
      targetId: absence.id,
      details: {
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      },
      ipAddress: context?.ipAddress,
    });

    return absence;
  }

  async review(
    id: string,
    data: ReviewAbsenceDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const absence = await this.repository.findById(id);
    if (!absence) {
      throw new AppError("Đơn xin vắng mặt không tồn tại", 404, ERROR_CODE.ABSENCE_NOT_FOUND);
    }

    if (absence.status !== AbsenceStatus.PENDING) {
      throw new AppError(
        "Đơn xin vắng mặt này đã được xử lý",
        400,
        ERROR_CODE.ABSENCE_ALREADY_REVIEWED,
      );
    }

    const isDirectLeader = absence.user?.intern?.leaderId === actor.id;
    if (actor.role !== ROLES.ADMIN && !isDirectLeader) {
      throw new AppError(
        "Chỉ Leader trực tiếp hoặc Admin mới có quyền phê duyệt đơn xin vắng mặt",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const updated = await this.repository.review(id, data, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.REVIEW_GENERAL_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE,
      targetId: id,
      details: {
        status: data.status,
        reviewNote: data.reviewNote,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }
}
