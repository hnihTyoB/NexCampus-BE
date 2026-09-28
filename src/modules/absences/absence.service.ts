import { AbsenceRepository } from "./absence.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  AbsenceDto,
  AbsencePresignedUrlResponseDto,
  AbsenceQueryDto,
  CreateAbsenceDto,
  ReviewAbsenceDto,
  TaskConflictDto,
} from "./absence.dto";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { prisma } from "../../database/prisma.client";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { AbsenceDuration, AbsenceReasonType, AbsenceStatus } from "@prisma/client";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";
import { R2Service } from "../../common/services/r2.service";
import { formatVietnamDate } from "../../common/helpers/date.helper";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class AbsenceService {
  private readonly repository = new AbsenceRepository();
  private readonly r2Service = new R2Service();

  private async hasGlobalAccess(actorId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    return (
      callerPerms.has(PERMISSIONS.ROLE_READ) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ABSENCE_REVIEW) ||
      callerPerms.has(PERMISSIONS.STATS_ADMIN_READ)
    );
  }

  async findAll(query: AbsenceQueryDto, actor: UserPayload) {
    let scope: { userId?: string; leaderUserId?: string } | undefined;

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (intern) {
        scope = { userId: actor.id };
      } else {
        const leader = await prisma.leader.findFirst({
          where: { userId: actor.id },
          select: { id: true },
        });
        if (leader) {
          scope = { leaderUserId: actor.id };
        }
      }
    }

    return this.repository.findAll(query, scope);
  }

  async findById(id: string, actor: UserPayload): Promise<AbsenceDto> {
    const absence = await this.repository.findById(id);
    if (!absence) {
      throw new AppError(
        "Đơn xin nghỉ phép không tồn tại",
        404,
        ERROR_CODE.ABSENCE_NOT_FOUND,
      );
    }

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (intern && absence.userId !== actor.id) {
        throw new AppError("Bạn không có quyền xem đơn này", 403, ERROR_CODE.FORBIDDEN);
      }

      const leader = await prisma.leader.findFirst({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (leader && absence.user?.intern?.leaderId !== actor.id) {
        throw new AppError("Bạn không có quyền xem đơn này", 403, ERROR_CODE.FORBIDDEN);
      }
    }

    // Đính kèm danh sách task conflicts nếu là Leader hoặc Admin
    let conflictTasks: TaskConflictDto[] = [];
    if (hasGlobal || absence.user?.intern?.leaderId === actor.id) {
      conflictTasks = await this.repository.findConflictTasks(
        absence.userId,
        absence.startDate,
        absence.endDate,
      );
    }

    return {
      ...absence,
      conflictTasks,
    };
  }

  async getTaskConflicts(
    id: string,
    actor: UserPayload,
  ): Promise<TaskConflictDto[]> {
    const absence = await this.repository.findById(id);
    if (!absence) {
      throw new AppError(
        "Đơn xin nghỉ phép không tồn tại",
        404,
        ERROR_CODE.ABSENCE_NOT_FOUND,
      );
    }

    return this.repository.findConflictTasks(
      absence.userId,
      absence.startDate,
      absence.endDate,
    );
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

    // Kiểm tra trùng lặp với đơn xin nghỉ đang chờ duyệt hoặc đã duyệt
    const overlapping = await this.repository.findOverlapping(
      actor.id,
      start,
      end,
    );

    if (overlapping) {
      throw new AppError(
        `Bạn đã có một đơn xin nghỉ (${overlapping.status === AbsenceStatus.APPROVED ? "đã duyệt" : "đang chờ duyệt"}) trùng với khoảng thời gian này.`,
        400,
        ERROR_CODE.ABSENCE_OVERLAPPING,
      );
    }

    // Yêu cầu minh chứng nếu nghỉ thi
    if (data.reasonType === AbsenceReasonType.EXAM && (!data.evidenceUrl || data.evidenceUrl.trim().length === 0)) {
      throw new AppError(
        "Lý do nghỉ thi bắt buộc phải đính kèm minh chứng lịch thi (ảnh hoặc PDF)",
        400,
        ERROR_CODE.EVIDENCE_REQUIRED,
      );
    }

    const absence = await this.repository.create(data, actor.id);

    // Gửi thông báo đến Leader trực tiếp (nếu có)
    const internProfile = await prisma.intern.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        fullName: true,
        leaderId: true,
      },
    });

    if (internProfile?.leaderId) {
      const internName = internProfile.fullName || "Thực tập sinh";
      const startStr = formatVietnamDate(start);
      const endStr = formatVietnamDate(end);
      const timeStr = startStr === endStr ? startStr : `${startStr} - ${endStr}`;

      await notificationDispatcher
        .send({
          userId: internProfile.leaderId,
          channels: [NOTIFICATION_CHANNEL.WEB],
          web: {
            type: NOTIFICATION_TYPE.INFO,
            title: "Đơn xin nghỉ phép mới cần duyệt",
            content: `${internName} đã gửi đơn xin nghỉ phép (${timeStr}). Lý do: ${data.reason.slice(0, 100)}...`,
            actionUrl: "/leader/absences",
          },
        })
        .catch((err: any) => {
          console.warn("[AbsenceService] Failed to dispatch notification to leader:", err.message);
        });
    }

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_GENERAL_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE,
      targetId: absence.id,
      details: {
        startDate: data.startDate,
        endDate: data.endDate,
        durationUnit: data.durationUnit,
        reasonType: data.reasonType,
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
      throw new AppError(
        "Đơn xin nghỉ phép không tồn tại",
        404,
        ERROR_CODE.ABSENCE_NOT_FOUND,
      );
    }

    if (absence.status !== AbsenceStatus.PENDING) {
      throw new AppError(
        "Đơn xin nghỉ phép này đã được xử lý",
        400,
        ERROR_CODE.ABSENCE_ALREADY_REVIEWED,
      );
    }

    const isDirectLeader = absence.user?.intern?.leaderId === actor.id;
    const hasGlobalReview = await this.hasGlobalAccess(actor.id);
    if (!hasGlobalReview && !isDirectLeader) {
      throw new AppError(
        "Chỉ Leader trực tiếp hoặc Quản trị viên mới có quyền phê duyệt đơn xin nghỉ phép",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const updated = await this.repository.review(id, data, actor.id);

    // Tự động gia hạn các task bị trùng deadline nếu được Leader chọn
    let extendedCount = 0;
    if (data.status === "APPROVED" && data.autoExtendConflictTasks) {
      const conflictTasks = await this.repository.findConflictTasks(
        absence.userId,
        absence.startDate,
        absence.endDate,
      );

      if (conflictTasks.length > 0) {
        const taskIds = conflictTasks.map((t) => t.taskId);
        // Số ngày gia hạn: nếu người dùng không truyền, mặc định theo độ dài kỳ nghỉ
        const daysToExtend =
          data.extendDays ||
          Math.max(
            1,
            Math.ceil(
              (absence.endDate.getTime() - absence.startDate.getTime()) /
                (24 * 60 * 60 * 1000),
            ) + 1,
          );

        await this.repository.extendTaskDeadlines(
          taskIds,
          daysToExtend,
          actor.id,
        );
        extendedCount = taskIds.length;

        await this.repository.createAuditLog({
          actorId: actor.id,
          action: AUDIT_ACTION.EXTEND_CONFLICT_TASKS,
          targetType: AUDIT_TARGET_TYPE.TASK,
          targetId: id,
          details: {
            taskIds,
            daysExtended: daysToExtend,
            absenceId: id,
          },
          ipAddress: context?.ipAddress,
        });
      }
    }

    // Gửi thông báo đến Intern
    const isApproved = data.status === "APPROVED";
    const startStr = formatVietnamDate(absence.startDate);
    const endStr = formatVietnamDate(absence.endDate);
    const timeStr = startStr === endStr ? startStr : `${startStr} - ${endStr}`;

    const title = isApproved
      ? "Đơn xin nghỉ phép đã được phê duyệt"
      : "Đơn xin nghỉ phép đã bị từ chối";

    let content = isApproved
      ? `Đơn xin nghỉ phép ngày ${timeStr} của bạn đã được phê duyệt.`
      : `Đơn xin nghỉ phép ngày ${timeStr} của bạn đã bị từ chối.${data.reviewNote ? ` Ghi chú: ${data.reviewNote}` : ""}`;

    if (extendedCount > 0) {
      content += ` Hệ thống đã tự động gia hạn ${extendedCount} công việc có deadline trùng đợt nghỉ.`;
    }

    await notificationDispatcher
      .send({
        userId: absence.userId,
        channels: [NOTIFICATION_CHANNEL.WEB],
        web: {
          type: isApproved ? NOTIFICATION_TYPE.SUCCESS : NOTIFICATION_TYPE.ALERT,
          title,
          content,
          actionUrl: "/intern/absences",
        },
      })
      .catch((err: any) => {
        console.warn("[AbsenceService] Failed to dispatch notification to intern:", err.message);
      });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.REVIEW_GENERAL_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE,
      targetId: id,
      details: {
        status: data.status,
        reviewNote: data.reviewNote,
        autoExtendConflictTasks: data.autoExtendConflictTasks,
        extendedCount,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async cancel(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const absence = await this.repository.findById(id);
    if (!absence) {
      throw new AppError(
        "Đơn xin nghỉ phép không tồn tại",
        404,
        ERROR_CODE.ABSENCE_NOT_FOUND,
      );
    }

    if (absence.userId !== actor.id) {
      throw new AppError(
        "Bạn chỉ có quyền hủy đơn của chính mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    if (absence.status !== AbsenceStatus.PENDING) {
      throw new AppError(
        "Chỉ có thể hủy đơn khi đơn đang ở trạng thái Chờ duyệt (PENDING)",
        400,
        ERROR_CODE.ABSENCE_CANNOT_CANCEL,
      );
    }

    const updated = await this.repository.cancel(id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CANCEL_GENERAL_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE,
      targetId: id,
      details: {
        absenceId: id,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async getUploadPresignedUrl(
    fileName: string,
    mimeType: string,
    actor: UserPayload,
  ): Promise<AbsencePresignedUrlResponseDto> {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `absences/${actor.id}/${Date.now()}_${safeFileName}`;
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, mimeType);
    const fileUrl = this.r2Service.getPublicUrl(key);

    return {
      uploadUrl,
      fileUrl,
      filePath: key,
      key,
    };
  }
}
