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
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { ROLES } from "../../common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import {
  getVietnamToday,
  toCalendarDate,
} from "../../common/helpers/date.helper";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class DailyReportService {
  private readonly repository = new DailyReportRepository();
  private readonly r2Service = new R2Service();

  async submitReport(
    dto: CreateDailyReportDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    let internId: string;

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern) {
        throw new AppError(
          "Hồ sơ thực tập sinh không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      internId = intern.id;
    } else if (actor.role === ROLES.ADMIN || actor.role === ROLES.LEADER) {
      if (!dto.internId) {
        throw new AppError(
          "Cần truyền internId khi nộp báo cáo hộ",
          400,
          ERROR_CODE.BAD_REQUEST,
        );
      }
      const intern = await prisma.intern.findUnique({
        where: { id: dto.internId },
      });
      if (!intern) {
        throw new AppError(
          "Hồ sơ thực tập sinh không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      internId = intern.id;
    } else {
      throw new AppError(
        "Bạn không có quyền nộp báo cáo ngày",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Determine calendar date in Asia/Ho_Chi_Minh
    const reportDate = dto.date ? toCalendarDate(dto.date) : getVietnamToday();

    // Check if report already exists for this intern and calendar date
    const existing = await this.repository.findByInternAndDate(internId, reportDate);
    const isUpdate = !!existing;

    const result = await this.repository.upsert(
      internId,
      reportDate,
      dto,
      actor.id,
    );

    // Audit log
    await this.repository.createAuditLog({
      actorId: actor.id,
      action: isUpdate
        ? AUDIT_ACTION.UPDATE_DAILY_REPORT
        : AUDIT_ACTION.CREATE_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: result?.id,
      details: {
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
    // Prefix reports/ on Cloudflare R2 as required
    const key = `reports/${uniqueId}_${baseName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      key,
      input.mimeType,
    );
    const fileUrl = this.r2Service.getPublicUrl(key);

    return {
      uploadUrl,
      fileUrl,
      filePath: key,
    };
  }

  async findAll(query: DailyReportQueryDto, actor: UserPayload) {
    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern) {
        throw new AppError(
          "Hồ sơ thực tập sinh không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      return this.repository.findAll(query, { internId: intern.id });
    }

    if (actor.role === ROLES.LEADER) {
      const leaderProfile = await prisma.leader.findUnique({
        where: { userId: actor.id },
        include: { departments: true },
      });

      const leaderDepartmentIds =
        leaderProfile?.departments.map((d: { departmentId: string }) => d.departmentId) || [];
      const directInterns = await prisma.intern.findMany({
        where: { leaderId: actor.id, deletedAt: null },
        select: { id: true },
      });
      const directInternIds = directInterns.map((i: { id: string }) => i.id);

      return this.repository.findAll(query, {
        isLeader: true,
        leaderDepartmentIds,
        directInternIds,
      });
    }

    return this.repository.findAll(query, { isAdmin: true });
  }

  async findById(id: string, actor: UserPayload) {
    const report = await this.repository.findById(id);
    if (!report) {
      throw new AppError(
        "Báo cáo ngày không tồn tại",
        404,
        ERROR_CODE.REPORT_NOT_FOUND,
      );
    }

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "Bạn không có quyền xem báo cáo này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    } else if (actor.role === ROLES.LEADER) {
      const isDirect = report.intern?.user?.id === actor.id || report.intern?.id === actor.id;
      const leaderProfile = await prisma.leader.findUnique({
        where: { userId: actor.id },
        include: { departments: true },
      });
      const inDepartment = leaderProfile?.departments.some(
        (d: { departmentId: string }) => d.departmentId === report.intern?.departmentId,
      );

      const directIntern = await prisma.intern.findFirst({
        where: { id: report.internId, leaderId: actor.id },
      });

      if (!isDirect && !inDepartment && !directIntern) {
        throw new AppError(
          "Bạn không có quyền xem báo cáo của thực tập sinh này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    return report;
  }

  async update(
    id: string,
    dto: UpdateDailyReportDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const report = await this.findById(id, actor);

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "Bạn chỉ được chỉnh sửa báo cáo của mình",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
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

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "Bạn chỉ được xóa báo cáo của mình",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
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
    if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.LEADER) {
      throw new AppError(
        "Chỉ Leader và Admin mới có quyền phản hồi báo cáo ngày",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const report = await this.findById(id, actor);

    const result = await this.repository.addFeedback(id, feedback, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.FEEDBACK_DAILY_REPORT,
      targetType: AUDIT_TARGET_TYPE.DAILY_REPORT,
      targetId: id,
      details: {
        reportId: id,
        internName: report.intern?.fullName,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getCalendar(
    query: DailyReportCalendarQueryDto,
    actor: UserPayload,
  ): Promise<DailyReportCalendarResponseDto> {
    let internId: string;

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (!intern) {
        throw new AppError(
          "Hồ sơ thực tập sinh không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      internId = intern.id;
    } else {
      if (!query.internId) {
        throw new AppError(
          "Vui lòng cung cấp internId cần xem lịch",
          400,
          ERROR_CODE.BAD_REQUEST,
        );
      }
      internId = query.internId;

      if (actor.role === ROLES.LEADER) {
        const intern = await prisma.intern.findUnique({
          where: { id: internId },
          include: { department: true },
        });
        if (!intern) {
          throw new AppError(
            "Hồ sơ thực tập sinh không tồn tại",
            404,
            ERROR_CODE.NOT_FOUND,
          );
        }

        const isDirect = intern.leaderId === actor.id;
        const leaderProfile = await prisma.leader.findUnique({
          where: { userId: actor.id },
          include: { departments: true },
        });
        const inDept = leaderProfile?.departments.some(
          (d: { departmentId: string }) => d.departmentId === intern.departmentId,
        );

        if (!isDirect && !inDept) {
          throw new AppError(
            "Bạn không có quyền xem lịch của thực tập sinh này",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    const intern = await prisma.intern.findUnique({
      where: { id: internId },
      select: { startDate: true },
    });

    if (!intern) {
      throw new AppError(
        "Hồ sơ thực tập sinh không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const year = query.year;
    const month = query.month;

    // Date boundaries of the month in UTC representing Vietnam calendar days
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    const reports = await this.repository.findReportsByInternAndMonth(
      internId,
      startOfMonth,
      endOfMonth,
    );

    // Map reports by YYYY-MM-DD
    const reportMap = new Map<string, (typeof reports)[0]>();
    for (const r of reports) {
      const dStr = r.date.toISOString().slice(0, 10);
      reportMap.set(dStr, r);
    }

    const todayVN = getVietnamToday();
    const internStartVN = toCalendarDate(intern.startDate);

    const days: CalendarDayDto[] = [];
    let reportedDays = 0;
    let totalWorkingDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(Date.UTC(year, month - 1, d, 0, 0, 0, 0));
      const dayOfWeek = dayDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const report = reportMap.get(dateStr);

      let status: CalendarDayStatus;

      if (dayDate.getTime() < internStartVN.getTime()) {
        status = "OUT_OF_RANGE";
      } else if (dayOfWeek === 0) {
        status = "WEEKEND";
      } else if (dayDate.getTime() > todayVN.getTime()) {
        status = "FUTURE";
      } else if (report) {
        status = "REPORTED";
        reportedDays++;
        totalWorkingDays++;
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
      });
    }

    const missingDays = Math.max(0, totalWorkingDays - reportedDays);
    const submissionRate =
      totalWorkingDays > 0
        ? Number(((reportedDays / totalWorkingDays) * 100).toFixed(1))
        : 100;

    return {
      internId,
      month,
      year,
      totalWorkingDays,
      reportedDays,
      missingDays,
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

    if (actor.role === ROLES.INTERN) {
      if (attachment.report.intern?.userId !== actor.id) {
        throw new AppError(
          "Bạn chỉ được xóa tệp đính kèm thuộc báo cáo của mình",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // Delete from R2 object store
    try {
      await this.r2Service.deleteFile(attachment.filePath);
    } catch (r2Err: any) {
      console.warn(`[DailyReportService] Could not delete R2 object ${attachment.filePath}:`, r2Err.message);
    }

    // Delete from DB
    await this.repository.deleteAttachment(attachmentId);

    return { success: true, message: "Tệp đính kèm đã được xóa thành công" };
  }
}
