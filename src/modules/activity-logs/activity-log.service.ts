import { ActivityLogRepository } from "./activity-log.repository";
import {
  ActivityLogListResponseDto,
  CreateAuditLogInput,
  QueryActivityLogDto,
} from "./activity-log.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class ActivityLogService {
  private readonly repository = new ActivityLogRepository();

  async findAll(
    query: QueryActivityLogDto,
  ): Promise<ActivityLogListResponseDto> {
    return this.repository.findMany(query);
  }

  async findById(id: string) {
    const log = await this.repository.findById(id);
    if (!log) {
      throw new AppError(
        "Nhật ký hoạt động không tồn tại",
        404,
        ERROR_CODE.AUDIT_LOG_NOT_FOUND,
      );
    }
    return log;
  }

  async log(data: CreateAuditLogInput) {
    try {
      return await this.repository.create(data);
    } catch (err: any) {
      console.error("[ActivityLogService] Failed to record audit log:", err.message);
      return null;
    }
  }
}

export const activityLogService = new ActivityLogService();

/**
 * Helper ghi nhận tự động mọi thao tác nhạy cảm vào bảng AuditLog tập trung
 */
export async function createAuditLog(data: CreateAuditLogInput) {
  return activityLogService.log(data);
}
