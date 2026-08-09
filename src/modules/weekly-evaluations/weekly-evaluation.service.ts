import { WeeklyEvaluationRepository } from "./weekly-evaluation.repository";
import { WeeklyEvaluationAiService } from "./weekly-evaluation.ai.service";
import { InternRepository } from "../interns/intern.repository";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  WeeklyEvaluationQueryDto,
  CreateWeeklyEvaluationDto,
  UpdateWeeklyEvaluationDto,
  AiSuggestionRequestDto,
  EvaluationRatings,
  RatingLevel,
} from "./weekly-evaluation.dto";
import { ROLES } from "../../common/constants/role.constant";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

/** Quy đổi mức xếp loại thành điểm số (thang 10) */
export function ratingToScore(rating: RatingLevel): number {
  switch (rating) {
    case "TOT": return 10;
    case "KHA": return 8;
    case "TB":  return 6;
    case "TBY": return 4;
    case "YEU": return 2;
  }
}

/**
 * Tính trung bình cộng của danh sách điểm số.
 * Làm tròn đến 2 chữ số thập phân.
 */
function avg(scores: number[]): number {
  return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
}

/**
 * Từ 12 xếp loại, tính 4 nhóm điểm tương thích ngược:
 *  - communication = I.5 (communication) và II.4 (teamwork)
 *  - attitude      = I.1 (ruleCompliance) + I.2 (workAttitude) + I.4 (resilience)
 *  - learning      = I.3 (learningCapacity) + II.1 (knowledge) + II.5 (creativity)
 *  - coding        = II.2 (practicalSkills) + III.1 (contentQuality) + III.2 (progressDelivery)
 */
export function computeLegacyScores(ratings: EvaluationRatings): {
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  totalScore: number;
} {
  const communication = avg([
    ratingToScore(ratings.communication),
    ratingToScore(ratings.teamwork),
  ]);
  const attitude = avg([
    ratingToScore(ratings.ruleCompliance),
    ratingToScore(ratings.workAttitude),
    ratingToScore(ratings.resilience),
  ]);
  const learning = avg([
    ratingToScore(ratings.learningCapacity),
    ratingToScore(ratings.knowledge),
    ratingToScore(ratings.creativity),
  ]);
  const coding = avg([
    ratingToScore(ratings.practicalSkills),
    ratingToScore(ratings.contentQuality),
    ratingToScore(ratings.progressDelivery),
  ]);

  // totalScore = trung bình cộng của cả 12 tiêu chí
  const allScores = [
    ratingToScore(ratings.ruleCompliance),
    ratingToScore(ratings.workAttitude),
    ratingToScore(ratings.learningCapacity),
    ratingToScore(ratings.resilience),
    ratingToScore(ratings.communication),
    ratingToScore(ratings.knowledge),
    ratingToScore(ratings.practicalSkills),
    ratingToScore(ratings.foreignLanguage),
    ratingToScore(ratings.teamwork),
    ratingToScore(ratings.creativity),
    ratingToScore(ratings.contentQuality),
    ratingToScore(ratings.progressDelivery),
  ];
  const totalScore = avg(allScores);

  return { communication, attitude, learning, coding, totalScore };
}

export class WeeklyEvaluationService {
  private readonly repository = new WeeklyEvaluationRepository();
  private readonly internRepository = new InternRepository();
  private readonly aiService = new WeeklyEvaluationAiService();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: WeeklyEvaluationQueryDto, user: UserPayload) {
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern) {
        throw new AppError(
          "Intern profile not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      query.internId = intern.id;
    } else if (user.role === ROLES.LEADER) {
      query.leaderId = user.id;
    }
    return this.repository.findAll(query);
  }

  async findById(id: string, user?: UserPayload) {
    const evaluation = await this.repository.findById(id);

    if (!evaluation) {
      throw new AppError(
        "Weekly evaluation not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (user && user.role !== ROLES.ADMIN) {
      if (user.role === ROLES.INTERN) {
        const intern = await this.internRepository.findByUserId(user.id);
        if (!intern || evaluation.internId !== intern.id) {
          throw new AppError(
            "You are not authorized to view this evaluation",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      } else if (user.role === ROLES.LEADER) {
        const isDirectLeader = evaluation.intern.leaderId === user.id || evaluation.leaderId === user.id;
        const leaderProfile = await prisma.leader.findUnique({
          where: { userId: user.id },
          include: { departments: true },
        });
        const inLeaderDepartment = leaderProfile?.departments.some(
          (d) => d.departmentId === evaluation.intern.department?.id,
        );

        if (!isDirectLeader && !inLeaderDepartment) {
          throw new AppError(
            "You are not authorized to view this evaluation",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    return evaluation;
  }

  async create(data: CreateWeeklyEvaluationDto, leaderId: string) {
    // 1. Ensure intern exists and is not soft-deleted
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // Validate week number against intern's timeline
    const start = new Date(intern.startDate);
    start.setHours(0, 0, 0, 0);

    const today = new Date();
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    const elapsedWeeks = Math.ceil((todayMidnight.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
    const maxAllowedWeek = Math.max(1, elapsedWeeks);

    if (data.week < 1 || data.week > maxAllowedWeek) {
      throw new AppError(
        `Tuần đánh giá phải nằm trong khoảng từ 1 đến ${maxAllowedWeek} (tuần thực tập hiện tại)`,
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    if (data.week === maxAllowedWeek) {
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
      const hours = today.getHours();
      const isSaturdayAllowed = dayOfWeek === 6 && hours >= 11;
      const isSundayAllowed = dayOfWeek === 0;

      if (!isSaturdayAllowed && !isSundayAllowed) {
        throw new AppError(
          "Chỉ có thể đánh giá tuần hiện tại từ Thứ Bảy (sau 11:00 sáng) đến hết Chủ Nhật",
          400,
          ERROR_CODE.BAD_REQUEST,
        );
      }
    }

    // 2. Ensure unique evaluation per week for that intern
    const existing = await this.repository.findByInternAndWeek(
      data.internId,
      data.week,
    );
    if (existing) {
      throw new AppError(
        "An evaluation for this intern and week already exists",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // 3. Compute scores — nếu có ratings mới thì tính từ ratings, ngược lại dùng 4 điểm cũ
    let communication = data.communication;
    let attitude = data.attitude;
    let learning = data.learning;
    let coding = data.coding;
    let totalScore: number;

    if (data.ratings) {
      const computed = computeLegacyScores(data.ratings);
      communication = computed.communication;
      attitude = computed.attitude;
      learning = computed.learning;
      coding = computed.coding;
      totalScore = computed.totalScore;
    } else {
      totalScore = (communication + attitude + learning + coding) / 4;
    }

    // 4. Detect leaderEdited
    const leaderEdited = this.detectLeaderEdited(data);

    const result = await this.repository.create(
      { ...data, communication, attitude, learning, coding },
      totalScore,
      leaderId,
      leaderEdited,
    );

    // Notify the intern of the weekly evaluation
    await NotificationDispatcher.dispatch(intern.userId, "WEEKLY_EVALUATION", {
      week: data.week,
      totalScore: totalScore.toFixed(1),
    });

    await this.activityLogService.log(
      leaderId,
      ACTIVITY_ACTIONS.CREATE_EVALUATION,
      `Leader đã chấm điểm tuần ${data.week} cho Intern "${intern.fullName}": Điểm TB ${totalScore.toFixed(1)}`,
      result.id,
      "WeeklyEvaluation",
    );

    return result;
  }

  async update(
    id: string,
    data: UpdateWeeklyEvaluationDto,
    actorId: string,
  ) {
    const evaluation = await this.findById(id);

    let communication = data.communication;
    let attitude = data.attitude;
    let learning = data.learning;
    let coding = data.coding;
    let totalScore: number | undefined;

    // Nếu update có ratings mới thì tính toán lại toàn bộ
    if (data.ratings) {
      const computed = computeLegacyScores(data.ratings);
      communication = computed.communication;
      attitude = computed.attitude;
      learning = computed.learning;
      coding = computed.coding;
      totalScore = computed.totalScore;
    } else if (
      data.communication !== undefined ||
      data.attitude !== undefined ||
      data.learning !== undefined ||
      data.coding !== undefined
    ) {
      const comm = communication !== undefined ? communication : evaluation.communication;
      const att  = attitude !== undefined ? attitude : evaluation.attitude;
      const learn = learning !== undefined ? learning : evaluation.learning;
      const code  = coding !== undefined ? coding : evaluation.coding;
      totalScore = (comm + att + learn + code) / 4;
    }

    const result = await this.repository.update(id, {
      ...data,
      ...(communication !== undefined && { communication }),
      ...(attitude !== undefined && { attitude }),
      ...(learning !== undefined && { learning }),
      ...(coding !== undefined && { coding }),
    }, totalScore);

    // Notify the intern of the evaluation update
    const finalScore =
      totalScore !== undefined ? totalScore : evaluation.totalScore;
    await NotificationDispatcher.dispatch(
      evaluation.intern.userId,
      "WEEKLY_EVALUATION",
      {
        week: evaluation.week,
        totalScore: finalScore.toFixed(1),
      },
    );

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_EVALUATION,
      `Leader đã cập nhật đánh giá tuần ${evaluation.week} của Intern "${evaluation.intern.fullName}"`,
      result.id,
      "WeeklyEvaluation",
    );

    return result;
  }

  async delete(id: string, actorId: string) {
    const evaluation = await this.findById(id);
    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_EVALUATION,
      `Leader đã xóa đánh giá tuần ${evaluation.week} của Intern "${evaluation.intern.fullName}"`,
      id,
      "WeeklyEvaluation",
    );

    return result;
  }

  /**
   * Gọi AI để gợi ý đánh giá cho intern trong tuần.
   * Chỉ ADMIN và LEADER mới có quyền gọi (đã enforce ở route).
   */
  async getAiSuggestion(data: AiSuggestionRequestDto, user: UserPayload) {
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const start = new Date(intern.startDate);
    start.setHours(0, 0, 0, 0);

    const today = new Date();
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    const elapsedWeeks = Math.ceil((todayMidnight.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
    const maxAllowedWeek = Math.max(1, elapsedWeeks);

    if (data.week < 1 || data.week > maxAllowedWeek) {
      throw new AppError(
        `Tuần đánh giá phải nằm trong khoảng từ 1 đến ${maxAllowedWeek} (tuần thực tập hiện tại)`,
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    if (data.week === maxAllowedWeek) {
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
      const hours = today.getHours();
      const isSaturdayAllowed = dayOfWeek === 6 && hours >= 11;
      const isSundayAllowed = dayOfWeek === 0;

      if (!isSaturdayAllowed && !isSundayAllowed) {
        throw new AppError(
          "Chỉ có thể đánh giá tuần hiện tại từ Thứ Bảy (sau 11:00 sáng) đến hết Chủ Nhật",
          400,
          ERROR_CODE.BAD_REQUEST,
        );
      }
    }

    return this.aiService.getSuggestion(data, user);
  }

  /**
   * Intern xác nhận đã xem đánh giá.
   * Chỉ cho phép intern sở hữu đánh giá đó gọi; reviewedAt chỉ ghi lần đầu.
   */
  async markReviewed(id: string, userId: string) {
    const evaluation = await this.findById(id);

    // Kiểm tra ownership — intern của evaluation phải trùng userId
    if (evaluation.intern.userId !== userId) {
      throw new AppError(
        "Bạn không có quyền xác nhận đánh giá này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Chỉ ghi lần đầu (idempotent)
    if (evaluation.reviewedAt) {
      return evaluation;
    }

    return this.repository.markReviewed(id);
  }

  /**
   * Phát hiện Leader có chỉnh sửa điểm AI hay không.
   * Nếu không có AI fields → false (không dùng AI).
   * Nếu có AI fields và điểm khác AI → true (Leader đã chỉnh).
   * Nếu có AI fields và điểm giống AI → false (Leader chấp nhận AI).
   */
  private detectLeaderEdited(data: CreateWeeklyEvaluationDto): boolean {
    // So sánh ratings nếu có
    if (data.ratings && data.aiRatings) {
      const keys = Object.keys(data.ratings) as Array<keyof EvaluationRatings>;
      return keys.some(k => data.ratings![k] !== data.aiRatings![k]);
    }

    // Fallback: so sánh 4 điểm số cũ
    const hasAiFields =
      data.aiCommunication != null ||
      data.aiAttitude != null ||
      data.aiLearning != null ||
      data.aiCoding != null;

    if (!hasAiFields) return false;

    const changed =
      (data.aiCommunication != null &&
        data.aiCommunication !== data.communication) ||
      (data.aiAttitude != null && data.aiAttitude !== data.attitude) ||
      (data.aiLearning != null && data.aiLearning !== data.learning) ||
      (data.aiCoding != null && data.aiCoding !== data.coding);

    return changed;
  }
}
