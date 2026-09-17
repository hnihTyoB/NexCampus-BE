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
} from "./weekly-evaluation.ai.service";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { VIETNAM_OFFSET_MS } from "../../common/constants/date.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class WeeklyEvaluationService {
  private readonly repository = new WeeklyEvaluationRepository();
  private readonly aiService = new WeeklyEvaluationAiService();

  private async hasGlobalEvaluationAccess(userId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(userId),
    );
    return (
      callerPerms.has(PERMISSIONS.WEEKLY_EVALUATION_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_PERMISSION_ASSIGN)
    );
  }

  async create(
    dto: CreateWeeklyEvaluationDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    // 1. Verify intern profile
    const intern = await prisma.intern.findUnique({
      where: { id: dto.internId },
      include: {
        department: true,
        user: true,
      },
    });

    if (!intern) {
      throw new AppError(
        "Hồ sơ thực tập sinh không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 2. Authorization check: Leader must manage this intern
    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess) {
      const isDirect = intern.leaderId === actor.id;
      const leaderProfile = await prisma.leader.findUnique({
        where: { userId: actor.id },
        include: { departments: true },
      });
      const inDepartment = leaderProfile?.departments.some(
        (d: { departmentId: string }) => d.departmentId === intern.departmentId,
      );

      if (!isDirect && !inDepartment) {
        throw new AppError(
          "Bạn không có quyền đánh giá thực tập sinh này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // 3. Week calculation in Asia/Ho_Chi_Minh timezone
    const now = new Date();
    const todayLocal = new Date(now.getTime() + VIETNAM_OFFSET_MS);
    const todayMidnight = new Date(
      Date.UTC(
        todayLocal.getUTCFullYear(),
        todayLocal.getUTCMonth(),
        todayLocal.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const startLocal = new Date(
      new Date(intern.startDate).getTime() + VIETNAM_OFFSET_MS,
    );
    const startMidnight = new Date(
      Date.UTC(
        startLocal.getUTCFullYear(),
        startLocal.getUTCMonth(),
        startLocal.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const diffDays = Math.floor(
      (todayMidnight.getTime() - startMidnight.getTime()) /
        (24 * 3600 * 1000),
    );
    const elapsedWeeks = Math.floor(diffDays / 7) + 1;
    const maxAllowedWeek = Math.max(1, elapsedWeeks);

    if (dto.week < 1 || dto.week > maxAllowedWeek) {
      throw new AppError(
        `Tuần đánh giá phải nằm trong khoảng từ 1 đến ${maxAllowedWeek} (tuần thực tập hiện tại)`,
        400,
        ERROR_CODE.EVALUATION_INVALID_WEEK,
      );
    }

    // 4. Current week window constraint
    // For the current active week, evaluations open from Saturday 11:00 AM VN time through Sunday 23:59:59 VN time
    if (
      !(await this.hasGlobalEvaluationAccess(actor.id)) &&
      process.env.NODE_ENV !== "test" &&
      dto.week === maxAllowedWeek
    ) {
      const dayOfWeek = todayLocal.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const hours = todayLocal.getUTCHours();
      const isSaturdayAllowed = dayOfWeek === 6 && hours >= 11;
      const isSundayAllowed = dayOfWeek === 0;

      if (!isSaturdayAllowed && !isSundayAllowed) {
        throw new AppError(
          "Chỉ có thể đánh giá tuần hiện tại từ Thứ Bảy (sau 11:00 sáng) đến hết Chủ Nhật",
          400,
          ERROR_CODE.EVALUATION_WINDOW_CLOSED,
        );
      }
    }

    // 5. Unique check: no duplicate evaluations per intern per week
    const existing = await this.repository.findByInternAndWeek(
      dto.internId,
      dto.week,
    );
    if (existing) {
      throw new AppError(
        `Thực tập sinh đã có đánh giá cho tuần ${dto.week}`,
        409,
        ERROR_CODE.EVALUATION_ALREADY_EXISTS,
      );
    }

    // 6. Compute scores, grade, and week boundaries
    const score = computeAverageScore(dto.ratings);
    const grade = computeGrade(score);

    const weekRange = getWeekDateRange(new Date(intern.startDate), dto.week);
    const year = dto.year || weekRange.from.getUTCFullYear();

    const isAiAdjusted = this.detectLeaderEdited(dto);

    const result = await this.repository.create({
      dto,
      score,
      grade,
      leaderId: actor.id,
      isAiAdjusted,
      startDate: weekRange.from,
      endDate: weekRange.to,
      year,
    });

    // Audit log
    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_WEEKLY_EVALUATION,
      targetType: AUDIT_TARGET_TYPE.WEEKLY_EVALUATION,
      targetId: result.id,
      details: {
        week: dto.week,
        internId: dto.internId,
        score,
        grade,
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
    const evaluation = await this.repository.findById(id);
    if (!evaluation) {
      throw new AppError(
        "Bản đánh giá tuần không tồn tại",
        404,
        ERROR_CODE.EVALUATION_NOT_FOUND,
      );
    }

    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess && evaluation.leaderId !== actor.id) {
      throw new AppError(
        "Bạn chỉ được chỉnh sửa bản đánh giá do chính mình tạo",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    let score: number | undefined;
    let grade = undefined;
    let isAiAdjusted: boolean | undefined;

    if (dto.ratings) {
      score = computeAverageScore(dto.ratings);
      grade = computeGrade(score);

      if (evaluation.aiRatings) {
        const aiRatings = evaluation.aiRatings as unknown as EvaluationRatings;
        const keys = Object.keys(dto.ratings) as Array<keyof EvaluationRatings>;
        isAiAdjusted = keys.some((k) => dto.ratings![k] !== aiRatings[k]);
      }
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
        week: evaluation.week,
        internId: evaluation.internId,
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
    const evaluation = await this.repository.findById(id);
    if (!evaluation) {
      throw new AppError(
        "Bản đánh giá tuần không tồn tại",
        404,
        ERROR_CODE.EVALUATION_NOT_FOUND,
      );
    }

    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess && evaluation.leaderId !== actor.id) {
      throw new AppError(
        "Bạn chỉ được xóa bản đánh giá do chính mình tạo",
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
        internId: evaluation.internId,
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

    const intern = await prisma.intern.findUnique({
      where: { userId: actor.id },
    });
    if (intern) {
      return this.repository.findAll(query, { internId: intern.id });
    }

    const leaderProfile = await prisma.leader.findUnique({
      where: { userId: actor.id },
      include: { departments: true },
    });
    if (leaderProfile) {
      const leaderDepartmentIds =
        leaderProfile.departments.map((d: { departmentId: string }) => d.departmentId);
      const directInterns = await prisma.intern.findMany({
        where: { leaderId: actor.id, deletedAt: null },
        select: { id: true },
      });
      const directInternIds = directInterns.map((i: { id: string }) => i.id);

      return this.repository.findAll(query, {
        isLeader: true,
        leaderDepartmentIds,
        directInternIds,
        leaderId: actor.id,
      });
    }

    return this.repository.findAll(query, { isAdmin: true });
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
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (intern) {
        if (evaluation.internId !== intern.id) {
          throw new AppError(
            "Bạn không có quyền xem đánh giá này",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      } else {
        const isDirect =
          evaluation.leaderId === actor.id ||
          evaluation.intern?.user?.id === actor.id;
        const leaderProfile = await prisma.leader.findUnique({
          where: { userId: actor.id },
          include: { departments: true },
        });
        const inDepartment = leaderProfile?.departments.some(
          (d: { departmentId: string }) => d.departmentId === evaluation.intern?.departmentId,
        );

        const directIntern = await prisma.intern.findFirst({
          where: { id: evaluation.internId, leaderId: actor.id },
        });

        if (!isDirect && !inDepartment && !directIntern) {
          throw new AppError(
            "Bạn không có quyền xem đánh giá của thực tập sinh này",
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

    // Ownership check: only the target intern can confirm they read the evaluation
    const intern = await prisma.intern.findUnique({
      where: { userId: actor.id },
    });

    if (!intern || evaluation.internId !== intern.id) {
      throw new AppError(
        "Bạn không có quyền xác nhận đánh giá này",
        403,
        ERROR_CODE.NOT_EVALUATION_INTERN,
      );
    }

    // Idempotent: if already marked, return current state
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
        internId: evaluation.internId,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async getSummary(
    internId: string,
    actor: UserPayload,
  ): Promise<InternEvaluationSummaryDto> {
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

    const hasGlobalAccess = await this.hasGlobalEvaluationAccess(actor.id);
    if (!hasGlobalAccess) {
      if (intern.userId === actor.id) {
        // TTS xem chính mình
      } else {
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
            "Bạn không có quyền xem tổng kết của thực tập sinh này",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    const evaluations = await this.repository.findAllByIntern(internId);

    const totalEvaluations = evaluations.length;
    let avgScore = 0;
    let overallGrade = null;
    let viewedCount = 0;
    let unviewedCount = 0;

    if (totalEvaluations > 0) {
      const sum = evaluations.reduce((acc: number, curr: { score: number }) => acc + curr.score, 0);
      avgScore = Number((sum / totalEvaluations).toFixed(2));
      overallGrade = computeGrade(avgScore);
      viewedCount = evaluations.filter((e: { viewedAt: Date | string | null }) => !!e.viewedAt).length;
      unviewedCount = totalEvaluations - viewedCount;
    }

    // Recent 6 weeks for progress chart
    const recentWeeks = evaluations.slice(0, 6);

    // Trend calculation
    let trend: "IMPROVING" | "DECLINING" | "STABLE" = "STABLE";
    if (recentWeeks.length >= 2) {
      const newestScore = recentWeeks[0].score;
      const previousScore = recentWeeks[1].score;
      const diff = newestScore - previousScore;
      if (diff > 0.2) trend = "IMPROVING";
      else if (diff < -0.2) trend = "DECLINING";
      else trend = "STABLE";
    }

    return {
      internId,
      internName: intern.fullName,
      totalEvaluations,
      avgScore,
      overallGrade,
      viewedCount,
      unviewedCount,
      trend,
      recentWeeks,
    };
  }

  async getAiSuggestion(
    dto: AiSuggestRequestDto,
    actor: UserPayload,
  ): Promise<AiSuggestResponseDto> {
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

    const now = new Date();
    const todayLocal = new Date(now.getTime() + VIETNAM_OFFSET_MS);
    const todayMidnight = new Date(
      Date.UTC(
        todayLocal.getUTCFullYear(),
        todayLocal.getUTCMonth(),
        todayLocal.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const startLocal = new Date(
      new Date(intern.startDate).getTime() + VIETNAM_OFFSET_MS,
    );
    const startMidnight = new Date(
      Date.UTC(
        startLocal.getUTCFullYear(),
        startLocal.getUTCMonth(),
        startLocal.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const diffDays = Math.floor(
      (todayMidnight.getTime() - startMidnight.getTime()) /
        (24 * 3600 * 1000),
    );
    const elapsedWeeks = Math.floor(diffDays / 7) + 1;
    const maxAllowedWeek = Math.max(1, elapsedWeeks);

    if (dto.week < 1 || dto.week > maxAllowedWeek) {
      throw new AppError(
        `Tuần đánh giá phải nằm trong khoảng từ 1 đến ${maxAllowedWeek} (tuần thực tập hiện tại)`,
        400,
        ERROR_CODE.EVALUATION_INVALID_WEEK,
      );
    }

    if (
      !(await this.hasGlobalEvaluationAccess(actor.id)) &&
      process.env.NODE_ENV !== "test" &&
      dto.week === maxAllowedWeek
    ) {
      const dayOfWeek = todayLocal.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const hours = todayLocal.getUTCHours();
      const isSaturdayAllowed = dayOfWeek === 6 && hours >= 11;
      const isSundayAllowed = dayOfWeek === 0;

      if (!isSaturdayAllowed && !isSundayAllowed) {
        throw new AppError(
          "Chỉ có thể đánh giá tuần hiện tại từ Thứ Bảy (sau 11:00 sáng) đến hết Chủ Nhật",
          400,
          ERROR_CODE.EVALUATION_WINDOW_CLOSED,
        );
      }
    }

    return this.aiService.generateSuggestion(dto, actor);
  }

  private detectLeaderEdited(dto: CreateWeeklyEvaluationDto): boolean {
    if (!dto.aiRatings) return false;

    const keys = Object.keys(dto.ratings) as Array<keyof EvaluationRatings>;
    const ratingsChanged = keys.some((k) => dto.ratings[k] !== dto.aiRatings![k]);
    if (ratingsChanged) return true;

    if (dto.aiComment && dto.comment && dto.aiComment.trim() !== dto.comment.trim()) {
      return true;
    }

    return false;
  }
}
