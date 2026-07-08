import { WeeklyEvaluationRepository } from "./weekly-evaluation.repository";
import { WeeklyEvaluationAiService } from "./weekly-evaluation.ai.service";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  WeeklyEvaluationQueryDto,
  CreateWeeklyEvaluationDto,
  UpdateWeeklyEvaluationDto,
  AiSuggestionRequestDto,
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
    }
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const evaluation = await this.repository.findById(id);

    if (!evaluation) {
      throw new AppError(
        "Weekly evaluation not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return evaluation;
  }

  async create(data: CreateWeeklyEvaluationDto, leaderId: string) {
    // 1. Ensure intern exists and is not soft-deleted
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
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

    // 3. Compute totalScore
    const totalScore =
      (data.communication + data.attitude + data.learning + data.coding) / 4;

    // 4. Detect leaderEdited: nếu Leader gửi kèm AI fields và đã thay đổi ít nhất 1 điểm
    const leaderEdited = this.detectLeaderEdited(data);

    const result = await this.repository.create(
      data,
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

    let totalScore: number | undefined;

    // Recalculate totalScore if any criteria changes
    if (
      data.communication !== undefined ||
      data.attitude !== undefined ||
      data.learning !== undefined ||
      data.coding !== undefined
    ) {
      const comm =
        data.communication !== undefined
          ? data.communication
          : evaluation.communication;
      const att =
        data.attitude !== undefined ? data.attitude : evaluation.attitude;
      const learn =
        data.learning !== undefined ? data.learning : evaluation.learning;
      const code = data.coding !== undefined ? data.coding : evaluation.coding;
      totalScore = (comm + att + learn + code) / 4;
    }

    const result = await this.repository.update(id, data, totalScore);

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
    return this.aiService.getSuggestion(data, user);
  }

  /**
   * Phát hiện Leader có chỉnh sửa điểm AI hay không.
   * Nếu không có AI fields → false (không dùng AI).
   * Nếu có AI fields và điểm khác AI → true (Leader đã chỉnh).
   * Nếu có AI fields và điểm giống AI → false (Leader chấp nhận AI).
   */
  private detectLeaderEdited(data: CreateWeeklyEvaluationDto): boolean {
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
