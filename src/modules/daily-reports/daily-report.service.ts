import crypto from "crypto";
import { DailyReportRepository } from "./daily-report.repository";
import {
  CalendarDayDto,
  CalendarDayStatus,
  CreateDailyReportDto,
  DailyReportCalendarQueryDto,
  DailyReportCalendarResponseDto,
  DailyReportQueryDto,
  UpdateDailyReportDto,
  UploadReportAttachmentUrlInput,
  UploadReportAttachmentUrlResponseDto,
} from "./daily-report.dto";
import { R2Service } from "../../common/services/r2.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import {
  getVietnamToday,
  toCalendarDate,
} from "../../common/helpers/date.helper";
import { systemSettingService } from "../system-settings/system-setting.service";

interface UserPayload {
  id: string;
  email: string;
  role: string;
  portalType?: string;
}

export class DailyReportService {
  private readonly repository = new DailyReportRepository();
  private readonly r2Service = new R2Service();

  private async hasGlobalAccess(userId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(userId),
    );
    return (
      callerPerms.has(PERMISSIONS.DAILY_REPORT_DELETE) ||
      callerPerms.has(PERMISSIONS.DAILY_REPORT_UPDATE) ||
      callerPerms.has(PERMISSIONS.ROLE_READ) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN)
    );
  }

  /**
   * Kiểm tra quyền quản lý/người hướng dẫn đối với một user mục tiêu
   */
  private async isManagerOrMentorOfUser(
    actorId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (actorId === targetUserId) {
      return true;
    }

    const hasGlobal = await this.hasGlobalAccess(actorId);
    if (hasGlobal) {
      return true;
    }

    // Kiểm tra hồ sơ thực tập sinh của target user
    const profile = await this.repository.findInternshipProfileByUserId(targetUserId);

    if (!profile) {
      return false;
    }

    // 1. Kiểm tra trực tiếp mentor
    if (profile.mentorId === actorId) {
      return true;
    }

    // 2. Kiểm tra nếu actor là người quản lý phòng ban của target user
    if (profile.departmentId) {
      const isMgr = await this.repository.isDepartmentManager(profile.departmentId, actorId);
      if (isMgr) {
        return true;
      }
    }

    return false;
  }

  async submitReport(
    dto: CreateDailyReportDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const targetUserId = dto.userId || dto.internId || actor.id;

    // Nếu nộp báo cáo cho người khác, kiểm tra quyền
    if (targetUserId !== actor.id) {
      const isAllowed = await this.isManagerOrMentorOfUser(actor.id, targetUserId);
      if (!isAllowed) {
        throw new AppError(
          "Bạn không có quyền nộp báo cáo thay người dùng này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // Kiểm tra target user có tồn tại và đang hoạt động không
    const targetUser = await this.repository.findActiveUserById(targetUserId);
    if (!targetUser) {
      throw new AppError(
        "Người dùng không tồn tại hoặc đã bị vô hiệu hóa",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Xác định ngày báo cáo theo múi giờ Việt Nam
    const reportDate = dto.date ? toCalendarDate(dto.date) : getVietnamToday();

    // Kiểm tra xem báo cáo đã tồn tại trong ngày này chưa
    const existing = await this.repository.findByUserAndDate(targetUserId, reportDate);
    const isUpdate = !!existing;

    const result = await this.repository.upsert(
      targetUserId,
      reportDate,
      dto,
      actor.id,
    );

    // Ghi nhận Audit Log
    await this.repository.createAuditLog({
      actorId: actor.id,
      action: isUpdate
        ? AUDIT_ACTION.UPDATE_DAILY_REPORT
        : AUDIT_ACTION.CREATE_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: result?.id,
      details: {
        targetUserId,
        reportDate: reportDate.toISOString().slice(0, 10),
        isUpdate,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getUploadUrl(
    input: UploadReportAttachmentUrlInput,
    actor: UserPayload,
  ): Promise<UploadReportAttachmentUrlResponseDto> {
    const baseName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomUUID();
    const key = `daily-reports/${uniqueId}_${baseName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, input.mimeType);
    const fileUrl = this.r2Service.getPublicUrl(key);

    return {
      uploadUrl,
      fileUrl,
      filePath: key,
      key,
      publicUrl: fileUrl,
    };
  }

  private async verifyReportAccess(
    reportId: string,
    actor: UserPayload,
    actionDesc = "thao tác trên báo cáo này",
  ) {
    const report = await this.repository.findById(reportId);
    if (!report) {
      throw new AppError(
        "Báo cáo không tồn tại",
        404,
        ERROR_CODE.REPORT_NOT_FOUND,
      );
    }

    if (report.userId === actor.id) {
      return report;
    }

    const isAllowed = await this.isManagerOrMentorOfUser(actor.id, report.userId);
    if (!isAllowed) {
      throw new AppError(
        `Không có quyền ${actionDesc}`,
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    return report;
  }

  async getVideoUploadUrl(
    reportId: string,
    mimeType: string,
    actor: UserPayload,
  ) {
    await this.verifyReportAccess(reportId, actor, "tải video lên báo cáo này");
    const ext = mimeType.split("/")[1] ?? "mp4";
    const key = `daily-reports/${reportId}/video_${Date.now()}.${ext}`;
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, mimeType);
    const fileUrl = this.r2Service.getPublicUrl(key);
    return {
      uploadUrl,
      fileUrl,
      filePath: key,
      key,
      publicUrl: fileUrl,
    };
  }

  async confirmVideoUpload(
    reportId: string,
    filePath: string,
    actor: UserPayload,
  ) {
    await this.verifyReportAccess(reportId, actor, "cập nhật video cho báo cáo này");
    const videoUrl = this.r2Service.getPublicUrl(filePath);
    const updated = await this.repository.updateVideoDemo(reportId, videoUrl);
    return updated;
  }

  async getAttachmentUploadUrl(
    reportId: string,
    fileName: string,
    mimeType: string,
    actor: UserPayload,
  ) {
    await this.verifyReportAccess(reportId, actor, "tải tệp đính kèm lên báo cáo này");
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `daily-reports/${reportId}/${crypto.randomUUID()}_${safeFileName}`;
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, mimeType);
    const fileUrl = this.r2Service.getPublicUrl(key);
    return {
      uploadUrl,
      fileUrl,
      filePath: key,
      key,
      publicUrl: fileUrl,
    };
  }

  async confirmAttachmentUpload(
    reportId: string,
    data: { filePath: string; fileName: string; mimeType: string; fileSize: number },
    actor: UserPayload,
  ) {
    await this.verifyReportAccess(reportId, actor, "thêm tệp đính kèm vào báo cáo này");
    const fileUrl = this.r2Service.getPublicUrl(data.filePath);
    const attachment = await this.repository.addAttachment({
      reportId,
      fileName: data.fileName,
      fileUrl,
      filePath: data.filePath,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: actor.id,
    });
    return attachment;
  }

  async findAll(query: DailyReportQueryDto, actor: UserPayload) {
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (hasGlobal) {
      return this.repository.findAll(query, { isAdmin: true });
    }

    // Lấy các phòng ban mà actor làm quản lý và các user mà actor là mentor
    const [departmentIds, mentoredUserIds] = await Promise.all([
      this.repository.findManagedDepartmentIds(actor.id),
      this.repository.findMenteeUserIds(actor.id),
    ]);

    if (departmentIds.length > 0 || mentoredUserIds.length > 0) {
      return this.repository.findAll(query, {
        isReviewer: true,
        departmentIds,
        mentoredUserIds,
      });
    }

    // Nếu không quản lý phòng ban hay mentor ai, chỉ xem báo cáo của chính mình
    return this.repository.findAll(query, { userId: actor.id });
  }

  async findById(id: string, actor: UserPayload) {
    return this.verifyReportAccess(id, actor, "xem báo cáo này");
  }

  async update(
    id: string,
    dto: UpdateDailyReportDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const report = await this.findById(id, actor);

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && report.userId !== actor.id) {
      throw new AppError(
        "Bạn chỉ được chỉnh sửa báo cáo của mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const updated = await this.repository.update(id, dto, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UPDATE_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: id,
      details: {
        reportId: id,
        updatedFields: Object.keys(dto),
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async delete(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const report = await this.findById(id, actor);

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && report.userId !== actor.id) {
      throw new AppError(
        "Bạn chỉ được xóa báo cáo của mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.DELETE_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: id,
      details: {
        reportId: id,
      },
      ipAddress: context?.ipAddress,
    });

    return { success: true, message: "Báo cáo ngày đã được xóa thành công" };
  }

  async addFeedback(
    id: string,
    feedback: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const report = await this.findById(id, actor);

    if (report.userId === actor.id) {
      throw new AppError(
        "Không thể tự nhận xét báo cáo của chính mình",
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    const isAllowed = await this.isManagerOrMentorOfUser(actor.id, report.userId);
    if (!isAllowed) {
      throw new AppError(
        "Bạn không có quyền đánh giá hoặc nhận xét báo cáo này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.addFeedback(id, feedback, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.FEEDBACK_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: id,
      details: {
        reportId: id,
        authorId: report.userId,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getCalendar(
    query: DailyReportCalendarQueryDto,
    actor: UserPayload,
  ): Promise<DailyReportCalendarResponseDto> {
    const targetUserId = query.userId || query.internId || actor.id;

    if (targetUserId !== actor.id) {
      const isAllowed = await this.isManagerOrMentorOfUser(actor.id, targetUserId);
      if (!isAllowed) {
        throw new AppError(
          "Bạn không có quyền xem lịch của người dùng này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    const targetUser = await this.repository.findUserWithProfile(targetUserId);

    if (!targetUser) {
      throw new AppError(
        "Người dùng không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const year = query.year;
    const month = query.month;

    // Giới hạn ngày trong tháng theo UTC đại diện cho ngày Việt Nam
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    const [reports, approvedLeaves] = await Promise.all([
      this.repository.findReportsByUserAndMonth(
        targetUserId,
        startOfMonth,
        endOfMonth,
      ),
      this.repository.findApprovedLeavesForMonth(
        targetUserId,
        startOfMonth,
        endOfMonth,
      ),
    ]);

    // Map báo cáo theo định dạng YYYY-MM-DD
    const reportMap = new Map<string, (typeof reports)[0]>();
    for (const r of reports) {
      const dStr = r.date.toISOString().slice(0, 10);
      reportMap.set(dStr, r);
    }

    const todayVN = getVietnamToday();
    const userStartVN = targetUser.internshipProfile?.startDate
      ? toCalendarDate(targetUser.internshipProfile.startDate)
      : toCalendarDate(targetUser.createdAt);
    const workingDaysPerWeek = await systemSettingService.getWorkingDaysPerWeek();

    const days: CalendarDayDto[] = [];
    let reportedDays = 0;
    let totalWorkingDays = 0;
    let approvedLeaveDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(Date.UTC(year, month - 1, d, 0, 0, 0, 0));
      const dayOfWeek = dayDate.getUTCDay();
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const isWeekend = isoDay > workingDaysPerWeek;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const report = reportMap.get(dateStr);

      const matchingLeave = approvedLeaves.find((leave) => {
        const leaveStart = new Date(leave.startDate);
        leaveStart.setUTCHours(0, 0, 0, 0);
        const leaveEnd = new Date(leave.endDate);
        leaveEnd.setUTCHours(23, 59, 59, 999);
        return dayDate >= leaveStart && dayDate <= leaveEnd;
      });

      let status: CalendarDayStatus;

      if (dayDate.getTime() < userStartVN.getTime()) {
        status = "OUT_OF_RANGE";
      } else if (isWeekend) {
        status = "WEEKEND";
      } else if (report) {
        status = "REPORTED";
        reportedDays++;
        totalWorkingDays++;
      } else if (matchingLeave) {
        if (dayDate.getTime() > todayVN.getTime()) {
          status = "FUTURE";
        } else {
          status = "LEAVE_APPROVED";
          approvedLeaveDays++;
        }
      } else if (dayDate.getTime() > todayVN.getTime()) {
        status = "FUTURE";
      } else {
        status = "MISSING";
        totalWorkingDays++;
      }

      days.push({
        date: dateStr,
        dayOfWeek,
        status,
        reportId: report?.id,
        hoursWorked: report?.hoursWorked ?? undefined,
        hasFeedback: !!report?.feedback,
        leaveReason: matchingLeave?.reason,
        leaveDurationUnit: matchingLeave?.durationUnit,
      });
    }

    const missingDays = Math.max(0, totalWorkingDays - reportedDays);
    const submissionRate =
      totalWorkingDays > 0
        ? Number(((reportedDays / totalWorkingDays) * 100).toFixed(1))
        : 100;

    return {
      userId: targetUserId,
      internId: targetUserId,
      month,
      year,
      totalWorkingDays,
      reportedDays,
      missingDays,
      approvedLeaveDays,
      submissionRate,
      days,
    };
  }

  async deleteAttachment(attachmentId: string, actor: UserPayload) {
    const attachment = await this.repository.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new AppError(
        "Tệp đính kèm không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && attachment.report.userId !== actor.id) {
      throw new AppError(
        "Bạn chỉ được xóa tệp đính kèm thuộc báo cáo của mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Xóa từ R2 object storage nếu có cấu hình
    try {
      await this.r2Service.deleteFile(attachment.filePath);
    } catch (r2Err: any) {
      console.warn(`[DailyReportService] Could not delete R2 object ${attachment.filePath}:`, r2Err.message);
    }

    // Xóa từ DB
    await this.repository.deleteAttachment(attachmentId);

    return { success: true, message: "Tệp đính kèm đã được xóa thành công" };
  }
}

export const dailyReportService = new DailyReportService();
