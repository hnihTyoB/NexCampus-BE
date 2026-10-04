import { WeeklyEvaluationRepository } from "./weekly-evaluation.repository";
import {
  AiSuggestRequestDto,
  AiSuggestResponseDto,
  CreateWeeklyEvaluationDto,
  EvaluationRatings,
  InternEvaluationSummaryDto,
  UpdateWeeklyEvaluationDto,
  WeeklyEvaluationQueryDto,
} from "./weekly-evaluation.dto";
import {
  computeAverageScore,
  computeGrade,
  getWeekDateRange,
  WeeklyEvaluationAiService,
  weeklyEvaluationAiService,
} from "./weekly-evaluation.ai.service";

import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { VIETNAM_OFFSET_MS } from "../../common/constants/date.constant";
import { getVietnamWeekRange } from "../../common/helpers/date.helper";
import { systemSettingService } from "../system-settings/system-setting.service";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class WeeklyEvaluationService {
  private readonly repository = new WeeklyEvaluationRepository();

  async getAiSuggestion(
    dto: AiSuggestRequestDto,
    actor: { id: string; role: string },
  ) {
    return weeklyEvaluationAiService.generateSuggestion(dto, actor);
  }

  private readonly aiService = new WeeklyEvaluationAiService();

  private async hasGlobalEvaluationAccess(userId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(userId),
    );
    return (
      callerPerms.has(PERMISSIONS.WEEKLY_EVALUATION_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_PERMISSION_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ)
    );
  }

  /**
   * Helper phân giải ID thực tập sinh hoặc User ID sang User.id chuẩn
   */
  async resolveTargetUserId(targetUserOrInternId?: string | null): Promise<string> {
    if (!targetUserOrInternId) {
      throw new AppError("targetUserId hoặc internId là bắt buộc", 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const user = await this.repository.findUserById(targetUserOrInternId);
    if (user) return user.id;

    const profile = await this.repository.findInternshipProfileById(targetUserOrInternId);
    if (profile) return profile.userId;

    throw new AppError("Người dùng không tồn tại", 404, ERROR_CODE.NOT_FOUND);
  }

  /**
   * Kiểm tra quyền quản lý / mentor đối với target user
   */
  private async isManagerOrMentorOfUser(
    actorId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (actorId === targetUserId) {
      return true;
    }

    const hasGlobal = await this.hasGlobalEvaluationAccess(actorId);
    if (hasGlobal) {
      return true;
    }

    const profile = await this.repository.findInternshipProfileByUserId(targetUserId);

    if (!profile) return false;
    if (profile.mentorId === actorId) return true;

    if (profile.departmentId) {
      const isDeptMgr = await this.repository.isDepartmentManager(profile.departmentId, actorId);
      if (isDeptMgr) return true;
    }

    return false;
  }

  async create(
    dto: CreateWeeklyEvaluationDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const targetUserId = await this.resolveTargetUserId(dto.targetUserId || dto.internId);

    if (targetUserId === actor.id) {
      throw new AppError(
        "Không thể tự đánh giá tuần cho chính mình",
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    // 1. Verify target user
    const targetUser = await this.repository.findUserWithProfile(targetUserId);

    if (!targetUser) {
      throw new AppError(
        "Hồ sơ người dùng không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 2. Authorization check
    const isAllowed = await this.isManagerOrMentorOfUser(actor.id, targetUserId);
    if (!isAllowed) {
      throw new AppError(
        "Bạn không có quyền đánh giá người dùng này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // 3. Week calculation in Asia/Ho_Chi_Minh timezone
    const now = new Date();
    const todayLocal = new Date(now.getTime() + VIETNAM_OFFSET_MS);
    const todayMidnight = new Date(
      Date.UTC(
        todayLocal.getUTCFullYear(),
        todayLocal.getUTCMonth(),
        todayLocal.getUTCDate(),
      ),
    );

    const startDateRaw = targetUser.internshipProfile?.startDate
      ? new Date(targetUser.internshipProfile.startDate)
      : new Date(targetUser.createdAt);
    const internStartLocal = new Date(startDateRaw.getTime() + VIETNAM_OFFSET_MS);
    const internStartMidnight = new Date(
      Date.UTC(
        internStartLocal.getUTCFullYear(),
        internStartLocal.getUTCMonth(),
        internStartLocal.getUTCDate(),
      ),
    );

    const weekRange = getWeekDateRange(startDateRaw, dto.week);

    // 4. Validate evaluation timing window
    const daysDiff = Math.floor(
      (todayMidnight.getTime() - internStartMidnight.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const maxAllowedWeek = Math.max(1, Math.floor(daysDiff / 7) + 1);

    await this.validateEvaluationWindow(
      actor.id,
      { id: targetUser.id, startDate: startDateRaw, createdAt: targetUser.createdAt },
      dto.week,
      maxAllowedWeek,
      now,
      todayLocal,
    );

    const maxFutureDays = await systemSettingService.getEvaluationMaxFutureDays();
    const futureThreshold = new Date(todayMidnight);
    futureThreshold.setUTCDate(futureThreshold.getUTCDate() + maxFutureDays);

    if (weekRange.from > futureThreshold) {
      throw new AppError(
        `Không thể đánh giá tuần trong tương lai vượt quá ${maxFutureDays} ngày`,
        400,
        ERROR_CODE.EVALUATION_WINDOW_CLOSED,
      );
    }

    const maxPastWeeks = await systemSettingService.getEvaluationMaxPastWeeks();
    const pastThreshold = new Date(todayMidnight);
    pastThreshold.setUTCDate(pastThreshold.getUTCDate() - maxPastWeeks * 7);

    if (weekRange.to < pastThreshold) {
      throw new AppError(
        `Không thể đánh giá tuần quá khứ vượt quá ${maxPastWeeks} tuần`,
        400,
        ERROR_CODE.EVALUATION_WINDOW_CLOSED,
      );
    }

    // 5. Unique check
    const existing = await this.repository.findByTargetUserAndWeek(
      targetUserId,
      dto.week,
    );
    if (existing) {
      throw new AppError(
        `Đã tồn tại đánh giá cho tuần ${dto.week}`,
        409,
        ERROR_CODE.EVALUATION_ALREADY_EXISTS,
      );
    }

    // 6. Compute score & grade
    const score = computeAverageScore(dto.ratings);
    const grade = computeGrade(score);

    // 7. Determine if AI adjusted
    const isAiAdjusted = this.detectLeaderEdited({
      ratings: dto.ratings,
      aiRatings: dto.aiRatings,
      comment: dto.comment,
      aiComment: dto.aiComment,
    });

    const effectiveYear = dto.year || now.getFullYear();

    const result = await this.repository.create({
      dto: {
        ...dto,
        targetUserId,
        internId: targetUserId,
      },
      score,
      grade,
      evaluatorId: actor.id,
      isAiAdjusted,
      startDate: weekRange.from,
      endDate: weekRange.to,
      year: effectiveYear,
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_WEEKLY_EVALUATION,
      targetType: AUDIT_TARGET_TYPE.WEEKLY_EVALUATION,
      targetId: result!.id,
      details: {
        targetUserId,
        week: dto.week,
        score,
        grade,
        isAiAdjusted,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async update(
    id: string,
    dto: UpdateWeeklyEvaluationDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const evaluation = await this.findById(id, actor);

    const hasGlobal = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobal && evaluation.evaluatorId !== actor.id) {
      throw new AppError(
        "Chỉ người đánh giá hoặc Quản trị viên mới được sửa đánh giá này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    let score: number | undefined;
    let grade: ReturnType<typeof computeGrade> | undefined;

    if (dto.ratings) {
      score = computeAverageScore(dto.ratings);
      grade = computeGrade(score);
    }

    let isAiAdjusted: boolean | undefined;
    if (dto.ratings && evaluation.aiRatings) {
      const keys = Object.keys(dto.ratings) as (keyof EvaluationRatings)[];
      isAiAdjusted = keys.some(
        (k) => dto.ratings![k] !== (evaluation.aiRatings as any)[k],
      );
    }

    const updated = await this.repository.update({
      id,
      dto,
      score,
      grade,
      isAiAdjusted,
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UPDATE_WEEKLY_EVALUATION,
      targetType: AUDIT_TARGET_TYPE.WEEKLY_EVALUATION,
      targetId: id,
      details: {
        updatedFields: Object.keys(dto),
        newScore: score,
        newGrade: grade,
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
    const evaluation = await this.findById(id, actor);

    const hasGlobal = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobal && evaluation.evaluatorId !== actor.id) {
      throw new AppError(
        "Chỉ người đánh giá hoặc Quản trị viên mới có quyền xóa đánh giá này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.DELETE_WEEKLY_EVALUATION,
      targetType: AUDIT_TARGET_TYPE.WEEKLY_EVALUATION,
      targetId: id,
      details: {
        week: evaluation.week,
        targetUserId: evaluation.targetUserId,
      },
      ipAddress: context?.ipAddress,
    });

    return {
      success: true,
      message: "Đánh giá tuần đã được xóa thành công",
    };
  }

  async findAll(query: WeeklyEvaluationQueryDto, actor: UserPayload) {
    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (hasGlobalAccess) {
      return this.repository.findAll(query, { isAdmin: true });
    }

    // Lấy các phòng ban do actor quản lý và danh sách mentee
    const [departmentIds, directTargetUserIds] = await Promise.all([
      this.repository.findManagedDepartmentIds(actor.id),
      this.repository.findMenteeUserIds(actor.id),
    ]);

    if (departmentIds.length > 0 || directTargetUserIds.length > 0) {
      return this.repository.findAll(query, {
        isReviewer: true,
        departmentIds,
        directTargetUserIds,
        evaluatorId: actor.id,
      });
    }

    // Người dùng thông thường chỉ xem đánh giá của chính mình
    return this.repository.findAll(query, { targetUserId: actor.id });
  }

  async findById(id: string, actor: UserPayload) {
    const evaluation = await this.repository.findById(id);
    if (!evaluation) {
      throw new AppError(
        "Đánh giá tuần không tồn tại",
        404,
        ERROR_CODE.EVALUATION_NOT_FOUND,
      );
    }

    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess) {
      const isTargetUser = evaluation.targetUserId === actor.id;
      const isEvaluator = evaluation.evaluatorId === actor.id;

      if (!isTargetUser && !isEvaluator) {
        const isAllowed = await this.isManagerOrMentorOfUser(
          actor.id,
          evaluation.targetUserId,
        );
        if (!isAllowed) {
          throw new AppError(
            "Bạn không có quyền xem đánh giá này",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    return evaluation;
  }

  async confirmView(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const evaluation = await this.repository.findById(id);
    if (!evaluation) {
      throw new AppError(
        "Đánh giá tuần không tồn tại",
        404,
        ERROR_CODE.EVALUATION_NOT_FOUND,
      );
    }

    // Ownership check: chỉ chính người được đánh giá mới có quyền xác nhận
    if (evaluation.targetUserId !== actor.id && (evaluation as any).internId !== actor.id) {
      throw new AppError(
        "Bạn không có quyền xác nhận đánh giá này",
        403,
        ERROR_CODE.NOT_EVALUATION_INTERN,
      );
    }

    if (evaluation.viewedAt) {
      return evaluation;
    }

    const updated = await this.repository.markViewed(id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CONFIRM_WEEKLY_EVALUATION,
      targetType: AUDIT_TARGET_TYPE.WEEKLY_EVALUATION,
      targetId: id,
      details: {
        week: evaluation.week,
        targetUserId: evaluation.targetUserId,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async getSummary(
    targetUserOrInternId: string,
    actor: UserPayload,
  ): Promise<InternEvaluationSummaryDto> {
    const targetUserId = await this.resolveTargetUserId(targetUserOrInternId);

    const targetUser = await this.repository.findUserWithProfile(targetUserId);

    if (!targetUser) {
      throw new AppError(
        "Hồ sơ người dùng không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess && targetUser.id !== actor.id) {
      const isAllowed = await this.isManagerOrMentorOfUser(actor.id, targetUser.id);
      if (!isAllowed) {
        throw new AppError(
          "Bạn không có quyền xem tổng kết của người dùng này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    const evaluations = await this.repository.findAllByTargetUser(targetUserId);

    const totalEvaluations = evaluations.length;
    if (totalEvaluations === 0) {
      return {
        targetUserId,
        internId: targetUserId,
        internName: targetUser.fullName || targetUser.email || "",
        totalEvaluations: 0,
        avgScore: 0,
        overallGrade: null,
        viewedCount: 0,
        unviewedCount: 0,
        trend: "STABLE",
        recentWeeks: [],
      };
    }

    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const avgScore = Number((totalScore / totalEvaluations).toFixed(2));
    const overallGrade = computeGrade(avgScore);

    const viewedCount = evaluations.filter((e) => e.viewedAt !== null).length;
    const unviewedCount = totalEvaluations - viewedCount;

    let trend: "IMPROVING" | "DECLINING" | "STABLE" = "STABLE";
    if (evaluations.length >= 2) {
      const latestScore = evaluations[0].score;
      const prevScore = evaluations[1].score;
      if (latestScore > prevScore + 0.3) {
        trend = "IMPROVING";
      } else if (latestScore < prevScore - 0.3) {
        trend = "DECLINING";
      }
    }

    const recentWeeks = evaluations.slice(0, 8).map((e) => ({
      id: e.id,
      week: e.week,
      year: e.year,
      score: e.score,
      grade: e.grade,
      viewedAt: e.viewedAt,
      comment: e.comment,
      createdAt: e.createdAt,
    }));

    return {
      targetUserId,
      internId: targetUserId,
      internName: targetUser.fullName || targetUser.email || "",
      totalEvaluations,
      avgScore,
      overallGrade,
      viewedCount,
      unviewedCount,
      trend,
      recentWeeks,
    };
  }

  async aiSuggest(
    dto: AiSuggestRequestDto,
    actor: UserPayload,
  ): Promise<AiSuggestResponseDto> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasCreatePerm =
      callerPerms.has(PERMISSIONS.WEEKLY_EVALUATION_CREATE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!hasCreatePerm) {
      throw new AppError(
        "Bạn không có quyền sử dụng tính năng AI gợi ý đánh giá",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    return this.aiService.generateSuggestion(dto, actor);
  }

  private detectLeaderEdited(data: {
    ratings: EvaluationRatings;
    aiRatings?: EvaluationRatings | null;
    comment?: string | null;
    aiComment?: string | null;
  }): boolean {
    if (!data.aiRatings) return false;
    const keys = Object.keys(data.ratings) as (keyof EvaluationRatings)[];
    const isRatingsChanged = keys.some((k) => data.ratings[k] !== data.aiRatings![k]);
    if (isRatingsChanged) return true;
    if (data.comment && data.aiComment && data.comment.trim() !== data.aiComment.trim()) {
      return true;
    }
    return false;
  }

  private async isAssignedMidWeekThisWeek(
    intern: { id: string; startDate: Date; createdAt: Date },
    now: Date,
    leaderUserId?: string,
  ): Promise<boolean> {
    const { startOfWeek, endOfWeek } = getVietnamWeekRange(now);
    const endOfMonday = new Date(startOfWeek.getTime() + 24 * 3600 * 1000 - 1);

    if (intern.startDate > endOfMonday && intern.startDate <= endOfWeek) return true;
    if (intern.createdAt > endOfMonday && intern.createdAt <= endOfWeek) return true;

    const reassignedLog = await this.repository.findMidWeekReassignLog(
      intern.id,
      endOfMonday,
      endOfWeek,
    );

    if (reassignedLog) {
      const details = reassignedLog.details as { leaderId?: string } | null;
      if (!leaderUserId || details?.leaderId === leaderUserId) {
        return true;
      }
    }

    return false;
  }

  private async validateEvaluationWindow(
    actorId: string,
    intern: { id: string; startDate: Date; createdAt: Date },
    week: number,
    maxAllowedWeek: number,
    now: Date,
    todayLocal: Date,
  ): Promise<void> {
    if (
      (await this.hasGlobalEvaluationAccess(actorId)) ||
      process.env.NODE_ENV === "test" ||
      week !== maxAllowedWeek
    ) {
      return;
    }

    // Thực tập sinh mới được giao giữa tuần không tính vào WeeklyEvaluation tuần này
    const isMidWeek = await this.isAssignedMidWeekThisWeek(intern, now, actorId);
    if (isMidWeek) {
      throw new AppError(
        "Thực tập sinh mới được giao giữa tuần, không áp dụng đánh giá cho tuần này",
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    const workingDaysPerWeek = await systemSettingService.getWorkingDaysPerWeek();
    const dayOfWeek = todayLocal.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 = Monday, ..., 7 = Sunday
    const hours = todayLocal.getUTCHours();

    const isLastWorkingDayAllowed = isoDay === workingDaysPerWeek && hours >= 11;
    const isWeekendAllowed = isoDay > workingDaysPerWeek;

    if (!isLastWorkingDayAllowed && !isWeekendAllowed) {
      const VIETNAM_DAY_NAMES: Record<number, string> = {
        1: "Thứ Hai",
        2: "Thứ Ba",
        3: "Thứ Tư",
        4: "Thứ Năm",
        5: "Thứ Sáu",
        6: "Thứ Bảy",
        7: "Chủ Nhật",
      };
      const startDayName = VIETNAM_DAY_NAMES[workingDaysPerWeek] || "Thứ Bảy";
      const message =
        workingDaysPerWeek === 7
          ? "Chỉ có thể đánh giá tuần hiện tại vào Chủ Nhật (sau 11:00 sáng)"
          : `Chỉ có thể đánh giá tuần hiện tại từ ${startDayName} (sau 11:00 sáng) đến hết Chủ Nhật`;

      throw new AppError(message, 400, ERROR_CODE.EVALUATION_WINDOW_CLOSED);
    }
  }
}

export const weeklyEvaluationService = new WeeklyEvaluationService();
