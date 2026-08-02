import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { TaskAllocationAiService } from "./task-allocation.ai.service";
import {
  InternCandidateRaw,
  ScoredCandidate,
  AiRecommendationResponseDto,
  CandidateSummaryDto,
  GroupAiRecommendationResponseDto,
  ConfirmGroupAllocationPayloadDto,
  GroupTaskAiRecommendationItemDto,
} from "./task-allocation.dto";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { ROLES } from "../../common/constants/role.constant";

// ─── Cấu hình thuật toán ──────────────────────────────────────────────────────

/** Trọng số cho CompatibilityScore (tổng = 1.0) */
const WEIGHTS = {
  workload:     0.35,
  skill:        0.25,
  performance:  0.20,
  learning:     0.20,
} as const;

/**
 * Số ngày công tối đa coi là "full capacity" của một intern.
 * Nếu intern đang gánh >= số này → workloadScore = 0.
 */
const MAX_WORKLOAD_DAYS = 10;
const SUPPORT_WORKLOAD_FACTOR = 0.5;

/**
 * Ngưỡng rủi ro burnout:
 * activeTaskDays / MAX_WORKLOAD_DAYS >= HIGH_RISK_THRESHOLD → riskLevel = HIGH
 */
const HIGH_RISK_THRESHOLD = 0.8;
const MEDIUM_RISK_THRESHOLD = 0.5;

/**
 * Điểm performance mặc định khi intern chưa có WeeklyEvaluation nào.
 * Dùng 50 (neutral) để không loại intern mới.
 */
const DEFAULT_PERFORMANCE_SCORE = 50;

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

// ─── Domain keywords để đối chiếu skill/position ──────────────────────────────

/** Map từ từ khóa trong tên Position/Task.module → domain group */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  backend:  ["backend", "be", "server", "api", "nodejs", "express", "prisma", "database", "sql", "rest"],
  frontend: ["frontend", "fe", "ui", "ux", "react", "next", "nextjs", "typescript", "css", "html"],
  mobile:   ["mobile", "ios", "android", "flutter", "react native"],
  devops:   ["devops", "docker", "ci", "cd", "deploy", "aws", "cloud", "infra"],
  design:   ["design", "figma", "ux", "ui/ux"],
};

function extractDomain(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return domain;
  }
  return null;
}

// ─── Score Calculators ────────────────────────────────────────────────────────

/**
 * WorkloadScore (0-100):
 * Càng rảnh → điểm càng cao.
 * Quá tải hoàn toàn (>= MAX_WORKLOAD_DAYS) → 0.
 */
function calculateWorkloadScore(
  activeTaskDays: number,
  maxWorkloadDays = MAX_WORKLOAD_DAYS,
): number {
  if (activeTaskDays <= 0) return 100;
  if (activeTaskDays >= maxWorkloadDays) return 0;
  return Math.round((1 - activeTaskDays / maxWorkloadDays) * 100);
}

/**
 * SkillScore (0-100):
 * So khớp domain của Position intern với domain của Task.module.
 * Nếu không xác định được domain → neutral 50.
 */
function calculateSkillScore(
  intern: InternCandidateRaw,
  taskModule: string | null,
  taskPhase: string | null,
): number {
  const taskDomain = extractDomain(taskModule) ?? extractDomain(taskPhase);
  const internDomain =
    extractDomain(intern.position?.name) ??
    extractDomain(intern.department?.name);

  if (!taskDomain || !internDomain) return 50; // không đủ thông tin → neutral
  if (taskDomain === internDomain) return 100;  // match chính xác

  // Bonus nhỏ nếu intern đã từng hoàn thành task cùng module
  const hasModuleHistory = intern.completedModules.some(
    (m) => extractDomain(m) === taskDomain,
  );
  return hasModuleHistory ? 60 : 20; // không match domain nhưng có lịch sử → 60
}

/**
 * PerformanceScore (0-100):
 * Dựa vào WeeklyEvaluation gần nhất — ưu tiên điểm coding (70%) + learning (30%).
 * Nếu chưa có evaluation → DEFAULT_PERFORMANCE_SCORE.
 */
function calculatePerformanceScore(
  codingScore: number | null,
  learningScore: number | null,
): number {
  if (codingScore === null) return DEFAULT_PERFORMANCE_SCORE;
  const coding = codingScore;
  const learning = learningScore ?? coding; // nếu thiếu learning, dùng coding
  return Math.round(((coding * 0.7 + learning * 0.3) / 10) * 100);
}

/**
 * LearningScore (0-100):
 * = Novelty × Capability
 *
 * Novelty:
 *   - Chưa từng làm module/domain này → novelty cao (1.0)
 *   - Đã làm rồi → novelty thấp (0.4)
 *
 * Capability:
 *   - codingScore / 10 (phải đủ năng lực thì "cơ hội học" mới thực sự có giá trị)
 *
 * Ví dụ:
 *   Chưa làm + coding 8 → 1.0 × 0.8 × 100 = 80
 *   Chưa làm + coding 5 → 1.0 × 0.5 × 100 = 50
 *   Đã làm   + coding 9 → 0.4 × 0.9 × 100 = 36
 */
function calculateLearningScore(
  intern: InternCandidateRaw,
  taskModule: string | null,
  taskPhase: string | null,
): number {
  const codingScore = intern.latestCodingScore ?? 5; // neutral nếu chưa có eval
  const capability = codingScore / 10;

  const taskDomain = extractDomain(taskModule) ?? extractDomain(taskPhase);
  const hasExperience = taskDomain
    ? intern.completedModules.some((m) => extractDomain(m) === taskDomain)
    : false;

  const novelty = hasExperience ? 0.4 : 1.0;
  return Math.round(novelty * capability * 100);
}

/**
 * CompatibilityScore (0-100):
 * Weighted sum của 4 thành phần.
 */
function calculateCompatibilityScore(scores: {
  workload: number;
  skill: number;
  performance: number;
  learning: number;
}): number {
  return Math.round(
    scores.workload    * WEIGHTS.workload    +
    scores.skill       * WEIGHTS.skill       +
    scores.performance * WEIGHTS.performance +
    scores.learning    * WEIGHTS.learning,
  );
}

// ─── Owner / Support Assignment ───────────────────────────────────────────────

/**
 * Xác định ai làm Owner, ai làm Support trong Top 2.
 *
 * Smart flip: Nếu Top 1 đã có kinh nghiệm rất cao (experiencer)
 * và Top 2 có đủ năng lực để học (learner) + còn capacity,
 * → Flip: Learner làm Owner (để học), Experiencer làm Support/Mentor.
 *
 * Đây là điểm tạo sự khác biệt so với "chỉ pick người điểm cao nhất".
 */
function assignOwnerSupportRoles(ranked: ScoredCandidate[]): ScoredCandidate[] {
  if (ranked.length < 2) {
    return ranked.map((c, i) => ({ ...c, suggestedRole: i === 0 ? "OWNER" : "SUPPORT" }));
  }

  const top1 = ranked[0];
  const top2 = ranked[1];

  // Flip condition: Top 1 experienced + Top 2 is a capable learner with capacity
  const shouldFlip =
    top1.skillScore >= 80 &&        // Top 1 đã rất match skill
    top1.learningScore <= 40 &&     // Top 1 đã làm rồi, ít cơ hội học
    top2.learningScore >= 60 &&     // Top 2 có cơ hội học tốt
    top2.workloadScore >= 50 &&     // Top 2 còn capacity
    top1.workloadScore >= 30;       // Top 1 vẫn còn đủ capacity để support

  // Dùng explicit type để tránh TS narrowing issue với suggestedRole union
  const result: ScoredCandidate[] = ranked.map((c) => ({
    ...c,
    suggestedRole: "SUPPORT" as "OWNER" | "SUPPORT",
  }));

  if (shouldFlip) {
    result[0] = { ...result[0], suggestedRole: "SUPPORT" }; // Top 1 → Support/Mentor
    result[1] = { ...result[1], suggestedRole: "OWNER" };   // Top 2 → Owner (learner)
  } else {
    result[0] = { ...result[0], suggestedRole: "OWNER" };   // Top 1 → Owner (default)
  }

  return result;
}

// ─── Risk Level ───────────────────────────────────────────────────────────────

function computeRiskLevel(
  ownerActiveTaskDays: number,
  maxWorkloadDays = MAX_WORKLOAD_DAYS,
): "LOW" | "MEDIUM" | "HIGH" {
  const util = ownerActiveTaskDays / maxWorkloadDays;
  if (util >= HIGH_RISK_THRESHOLD) return "HIGH";
  if (util >= MEDIUM_RISK_THRESHOLD) return "MEDIUM";
  return "LOW";
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class TaskAllocationService {
  private readonly aiService = new TaskAllocationAiService();
  private readonly activityLogService = new ActivityLogService();

  async getAiRecommendation(
    taskId: string,
    user: UserPayload,
  ): Promise<AiRecommendationResponseDto> {
    // ── 1. Lấy Task info ────────────────────────────────────────────────────
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        taskGroupId: true,
        taskGroup: {
          select: { maxWorkloadDays: true, maxActiveTasks: true },
        },
        title: true,
        description: true,
        module: true,
        phase: true,
        priority: true,
        estDays: true,
        deadline: true,
        assignment: { select: { id: true, internId: true } },
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (task.assignment && task.assignment.internId) {
      throw new AppError(
        "Task này đã được giao cho intern. Không thể tạo đề xuất mới.",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // ── 2. Lấy danh sách interns của leader ─────────────────────────────────
    const rawInterns = await prisma.intern.findMany({
      where: {
        ...(task.taskGroupId
          ? {
              taskGroupMemberships: {
                some: { taskGroupId: task.taskGroupId },
              },
            }
          : {}),
        ...(user.role === ROLES.LEADER ? { leaderId: user.id } : {}),
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        fullName: true,
        position: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        // Task assignments đang active (để tính workload)
        assignments: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
            task: { deletedAt: null },
          },
          select: {
            task: { select: { estDays: true, deadline: true } },
          },
        },
        // 3 tuần evaluation gần nhất (lấy tuần gần nhất để tính score)
        weeklyEvaluations: {
          orderBy: { week: "desc" },
          take: 3,
          select: { coding: true, learning: true, week: true },
        },
        // Task đã hoàn thành (để tính experience)
        supportedAssignments: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] },
            task: { deletedAt: null },
          },
          select: {
            status: true,
            task: { select: { module: true, phase: true, estDays: true } },
          },
        },
      },
    });

    // Thêm completed assignments từ internId
    const completedAssignmentsByIntern = await Promise.all(
      rawInterns.map((intern) =>
        prisma.taskAssignment.findMany({
          where: {
            internId: intern.id,
            status: "DONE",
            task: { deletedAt: null },
          },
          select: { task: { select: { module: true, phase: true } } },
        }),
      ),
    );

    if (rawInterns.length === 0) {
      throw new AppError(
        "Không tìm thấy intern nào đang active dưới sự quản lý của bạn.",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // ── 3. Enrich raw intern data ────────────────────────────────────────────
    const candidates: InternCandidateRaw[] = rawInterns.map((intern, idx) => {
      // Tổng tải Owner + 50% tải Support đang active.
      const ownerActiveTaskDays = intern.assignments.reduce(
        (sum, a) => sum + (a.task.estDays ?? 3), // default 3 nếu null
        0,
      );
      const activeSupportAssignments = intern.supportedAssignments.filter(
        (assignment) => assignment.status !== "DONE",
      );
      const supportActiveTaskDays = activeSupportAssignments.reduce(
        (sum, assignment) =>
          sum + (assignment.task.estDays ?? 3) * SUPPORT_WORKLOAD_FACTOR,
        0,
      );
      const activeTaskDays = ownerActiveTaskDays + supportActiveTaskDays;

      // Evaluation gần nhất
      const latestEval = intern.weeklyEvaluations[0] ?? null;

      // Completed modules: từ cả assigned tasks (owner) và supported tasks
      const ownerCompleted = completedAssignmentsByIntern[idx];
      const supportCompleted = intern.supportedAssignments.filter(
        (assignment) => assignment.status === "DONE",
      );
      const allCompleted = [...ownerCompleted, ...supportCompleted];
      const completedModules = allCompleted
        .map((a) => a.task.module)
        .filter((m): m is string => !!m);
      const completedPhases = allCompleted
        .map((a) => a.task.phase)
        .filter((p): p is string => !!p);

      return {
        id: intern.id,
        fullName: intern.fullName,
        position: intern.position,
        department: intern.department,
        activeTaskDays,
        activeTaskCount:
          intern.assignments.length + activeSupportAssignments.length,
        latestCodingScore: latestEval?.coding ?? null,
        latestLearningScore: latestEval?.learning ?? null,
        completedModules: [...new Set(completedModules)],
        completedPhases: [...new Set(completedPhases)],
      };
    });

    // ── 4. Tính điểm mỗi intern ──────────────────────────────────────────────
    const taskModule = task.module;
    const taskPhase = task.phase;

    const maxWorkloadDays = task.taskGroup?.maxWorkloadDays ?? MAX_WORKLOAD_DAYS;
    const maxActiveTasks = task.taskGroup?.maxActiveTasks ?? null;
    const addedDays = task.estDays ?? 3;
    const eligibleCandidates = candidates.filter(
      (intern) =>
        intern.activeTaskDays + addedDays <= maxWorkloadDays &&
        (maxActiveTasks === null || intern.activeTaskCount < maxActiveTasks),
    );
    if (eligibleCandidates.length === 0) {
      throw new AppError(
        "Không có thành viên còn đủ capacity cho task này.",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const scoredCandidates: ScoredCandidate[] = eligibleCandidates.map((intern) => {
      const workloadScore = calculateWorkloadScore(
        intern.activeTaskDays,
        maxWorkloadDays,
      );
      const skillScore       = calculateSkillScore(intern, taskModule, taskPhase);
      const performanceScore = calculatePerformanceScore(
        intern.latestCodingScore,
        intern.latestLearningScore,
      );
      const learningScore    = calculateLearningScore(intern, taskModule, taskPhase);
      const compatibilityScore = calculateCompatibilityScore({
        workload:    workloadScore,
        skill:       skillScore,
        performance: performanceScore,
        learning:    learningScore,
      });

      return {
        ...intern,
        workloadScore,
        skillScore,
        performanceScore,
        learningScore,
        compatibilityScore,
        suggestedRole: "OWNER" as const, // sẽ gán lại bên dưới
      };
    });

    // ── 5. Rank và assign roles ──────────────────────────────────────────────
    const ranked = [...scoredCandidates].sort(
      (a, b) => b.compatibilityScore - a.compatibilityScore,
    );
    const withRoles = assignOwnerSupportRoles(ranked);

    const owner   = withRoles.find((c) => c.suggestedRole === "OWNER");
    const support = withRoles.find((c) => c.suggestedRole === "SUPPORT" && c !== owner);

    if (!owner) {
      // Fallback an toàn — không nên xảy ra
      throw new AppError(
        "Không thể xác định Owner phù hợp.",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    // ── 6. Gọi Gemini để tạo giải thích ─────────────────────────────────────
    const taskInfo = {
      title:        task.title,
      module:       task.module ?? "Chưa xác định",
      priority:     task.priority,
      estDays:      task.estDays ?? 3,
      description:  task.description ?? "",
      deadline:     task.deadline,
      maxWorkloadDays,
    };

    const top3ForAi = withRoles.slice(0, 3);

    let aiOutput: { reasons: string[]; riskLevel: "LOW" | "MEDIUM" | "HIGH"; workloadAnalysis: string; learningOpportunity: string };
    let aiFailed = false;

    try {
      aiOutput = await this.aiService.generateRecommendation(taskInfo, top3ForAi);
    } catch (err) {
      aiFailed = true;
      // Fallback: tự tạo giải thích đơn giản từ thuật toán
      const ownerLoad = owner.activeTaskDays;
      aiOutput = {
        reasons: this.buildFallbackReasons(owner, taskModule, maxWorkloadDays),
        riskLevel: computeRiskLevel(ownerLoad, maxWorkloadDays),
        workloadAnalysis: `${owner.fullName} hiện đang gánh ${ownerLoad} ngày công (capacity ${MAX_WORKLOAD_DAYS} ngày).`,
        learningOpportunity: owner.learningScore >= 60
          ? `Đây là cơ hội tốt để ${owner.fullName} mở rộng kinh nghiệm với task này.`
          : `${owner.fullName} có nền tảng phù hợp để hoàn thành task hiệu quả.`,
      };
    }

    // ── 7. Build response ────────────────────────────────────────────────────
    const allCandidates: CandidateSummaryDto[] = withRoles.map((c) => ({
      id: c.id,
      name: c.fullName,
      position: c.position?.name ?? null,
      compatibilityScore: c.compatibilityScore,
      workloadScore: c.workloadScore,
      performanceScore: c.performanceScore,
      skillScore: c.skillScore,
      learningScore: c.learningScore,
      activeTaskDays: c.activeTaskDays,
      codingScore: c.latestCodingScore,
    }));

    return {
      owner: {
        id: owner.id,
        name: owner.fullName,
        position: owner.position?.name ?? null,
        compatibilityScore: owner.compatibilityScore,
        workloadDays: owner.activeTaskDays,
        codingScore: owner.latestCodingScore,
      },
      support: support
        ? {
            id: support.id,
            name: support.fullName,
            position: support.position?.name ?? null,
            compatibilityScore: support.compatibilityScore,
            workloadDays: support.activeTaskDays,
            codingScore: support.latestCodingScore,
          }
        : null,
      reasons: aiOutput.reasons,
      riskLevel: aiOutput.riskLevel,
      workloadAnalysis: aiOutput.workloadAnalysis,
      learningOpportunity: aiOutput.learningOpportunity,
      allCandidates,
      meta: {
        totalEvaluated: candidates.length,
        aiFailed,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // ─── Fallback reason builder ─────────────────────────────────────────────

  private buildFallbackReasons(
    owner: ScoredCandidate,
    taskModule: string | null,
    maxWorkloadDays = MAX_WORKLOAD_DAYS,
  ): string[] {
    const reasons: string[] = [];

    if (owner.workloadScore >= 70) {
      reasons.push(`Workload thấp - đang gánh ${owner.activeTaskDays} ngày công`);
    } else if (owner.workloadScore >= 40) {
      reasons.push(`Workload ở mức vừa phải - còn ${Math.max(0, maxWorkloadDays - owner.activeTaskDays)} ngày trống`);
    }

    if (owner.skillScore >= 80) {
      reasons.push(`Position phù hợp với yêu cầu của task`);
    }

    if (owner.latestCodingScore !== null && owner.latestCodingScore >= 7) {
      reasons.push(`Điểm Coding gần nhất: ${owner.latestCodingScore}/10`);
    }

    if (owner.learningScore >= 60) {
      reasons.push(taskModule
        ? `Chưa từng làm module ${taskModule} - cơ hội học và phát triển tốt`
        : `Có cơ hội học tập và phát triển với task này`);
    }

    if (reasons.length === 0) {
      reasons.push(`Là ứng viên phù hợp nhất dựa trên phân tích workload và năng lực`);
    }

    return reasons;
  }

  // ─── Group-level Bulk AI Allocation ──────────────────────────────────────

  async getGroupAiRecommendation(
    taskGroupId: string,
    user: UserPayload,
  ): Promise<GroupAiRecommendationResponseDto> {
    // 1. Lấy TaskGroup info
    const group = await prisma.taskGroup.findUnique({
      where: { id: taskGroupId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        maxWorkloadDays: true,
        maxActiveTasks: true,
        requireAllMembers: true,
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Lấy tất cả unassigned tasks trong group (bao gồm chưa có record hoặc có record nhưng internId = null)
    const unassignedTasks = await prisma.task.findMany({
      where: {
        taskGroupId,
        deletedAt: null,
        OR: [
          { assignment: null },
          { assignment: { internId: null } },
        ],
      },
      orderBy: [{ priority: "desc" }, { deadline: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        module: true,
        phase: true,
        priority: true,
        estDays: true,
        deadline: true,
      },
    });

    if (unassignedTasks.length === 0) {
      throw new AppError(
        "Không có task chưa phân công nào trong nhóm công việc này.",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Chỉ lấy TTS đã được thêm vào đội của Task Group.
    const rawInterns = await prisma.intern.findMany({
      where: {
        taskGroupMemberships: { some: { taskGroupId } },
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
        ...(user.role === ROLES.LEADER ? { leaderId: user.id } : {}),
        ...(group.departmentId ? { departmentId: group.departmentId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        position: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignments: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
            task: { deletedAt: null },
          },
          select: {
            task: { select: { estDays: true, deadline: true } },
          },
        },
        weeklyEvaluations: {
          orderBy: { week: "desc" },
          take: 3,
          select: { coding: true, learning: true, week: true },
        },
        supportedAssignments: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] },
            task: { deletedAt: null },
          },
          select: {
            status: true,
            task: { select: { module: true, phase: true, estDays: true } },
          },
        },
      },
    });

    if (rawInterns.length === 0) {
      const msg = group._count.members === 0
        ? "Task Group chưa có thành viên. Hãy thêm TTS vào đội trước khi chạy AI."
        : group.department?.name
          ? `Không có thành viên active thuộc quyền quản lý của bạn trong phòng ban "${group.department.name}".`
          : "Không có thành viên active thuộc quyền quản lý của bạn trong Task Group.";
      throw new AppError(msg, 422, ERROR_CODE.VALIDATION_ERROR);
    }

    // 4. Completed assignments
    const completedAssignmentsByIntern = await Promise.all(
      rawInterns.map((intern) =>
        prisma.taskAssignment.findMany({
          where: {
            internId: intern.id,
            status: "DONE",
            task: { deletedAt: null },
          },
          select: { task: { select: { module: true, phase: true } } },
        }),
      ),
    );

    // 5. Enrich base candidates
    const baseCandidates: InternCandidateRaw[] = rawInterns.map((intern, idx) => {
      const ownerActiveTaskDays = intern.assignments.reduce(
        (sum, a) => sum + (a.task.estDays ?? 3),
        0,
      );
      const activeSupportAssignments = intern.supportedAssignments.filter(
        (assignment) => assignment.status !== "DONE",
      );
      const supportActiveTaskDays = activeSupportAssignments.reduce(
        (sum, assignment) =>
          sum + (assignment.task.estDays ?? 3) * SUPPORT_WORKLOAD_FACTOR,
        0,
      );
      const activeTaskDays = ownerActiveTaskDays + supportActiveTaskDays;
      const latestEval = intern.weeklyEvaluations[0] ?? null;
      const ownerCompleted = completedAssignmentsByIntern[idx];
      const supportCompleted = intern.supportedAssignments.filter(
        (assignment) => assignment.status === "DONE",
      );
      const allCompleted = [...ownerCompleted, ...supportCompleted];

      return {
        id: intern.id,
        fullName: intern.fullName,
        position: intern.position,
        department: intern.department,
        activeTaskDays,
        activeTaskCount:
          intern.assignments.length + activeSupportAssignments.length,
        latestCodingScore: latestEval?.coding ?? null,
        latestLearningScore: latestEval?.learning ?? null,
        completedModules: [...new Set(allCompleted.map((a) => a.task.module).filter((m): m is string => !!m))],
        completedPhases: [...new Set(allCompleted.map((a) => a.task.phase).filter((p): p is string => !!p))],
      };
    });

    const simulatedWorkloadMap = new Map<string, number>();
    const simulatedTaskCountMap = new Map<string, number>();
    baseCandidates.forEach((candidate) => {
      simulatedWorkloadMap.set(candidate.id, candidate.activeTaskDays);
      simulatedTaskCountMap.set(candidate.id, candidate.activeTaskCount);
    });

    if (
      group.requireAllMembers &&
      unassignedTasks.length * 2 < baseCandidates.length
    ) {
      throw new AppError(
        "Không đủ vị trí Owner/Support để sử dụng toàn bộ thành viên của Task Group.",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const taskResults: GroupTaskAiRecommendationItemDto[] = [];
    const participatingMemberIds = new Set<string>();
    let allocatedCount = 0;

    for (const task of unassignedTasks) {
      const deadlineDay = new Date(task.deadline);
      deadlineDay.setHours(23, 59, 59, 999);
      if (deadlineDay < new Date()) {
        taskResults.push({
          taskId: task.id,
          taskTitle: task.title,
          taskCode: task.code,
          priority: task.priority,
          estDays: task.estDays,
          deadline: task.deadline.toISOString(),
          suggestedOwner: null,
          suggestedSupport: null,
          reason: "Task đã quá hạn nên không thể phân công",
        });
        continue;
      }

      const addedDays = task.estDays ?? 3;
      const scored: ScoredCandidate[] = baseCandidates.map((intern) => {
        const currentWorkload =
          simulatedWorkloadMap.get(intern.id) ?? intern.activeTaskDays;
        const workloadScore = calculateWorkloadScore(
          currentWorkload,
          group.maxWorkloadDays,
        );
        const skillScore = calculateSkillScore(intern, task.module, task.phase);
        const performanceScore = calculatePerformanceScore(
          intern.latestCodingScore,
          intern.latestLearningScore,
        );
        const learningScore = calculateLearningScore(
          intern,
          task.module,
          task.phase,
        );
        const compatibilityScore = calculateCompatibilityScore({
          workload: workloadScore,
          skill: skillScore,
          performance: performanceScore,
          learning: learningScore,
        });

        return {
          ...intern,
          activeTaskDays: currentWorkload,
          workloadScore,
          skillScore,
          performanceScore,
          learningScore,
          compatibilityScore,
          suggestedRole: "OWNER" as const,
        };
      });

      const ownerEligible = scored.filter((candidate) => {
        const currentTasks = simulatedTaskCountMap.get(candidate.id) ?? 0;
        return (
          candidate.activeTaskDays + addedDays <= group.maxWorkloadDays &&
          (group.maxActiveTasks === null || currentTasks < group.maxActiveTasks)
        );
      });
      const unusedOwners = ownerEligible.filter(
        (candidate) => !participatingMemberIds.has(candidate.id),
      );
      const ownerPool =
        group.requireAllMembers && unusedOwners.length > 0
          ? unusedOwners
          : ownerEligible;
      const rankedOwners = [...ownerPool].sort(
        (a, b) => b.compatibilityScore - a.compatibilityScore,
      );
      const owner = assignOwnerSupportRoles(rankedOwners).find(
        (candidate) => candidate.suggestedRole === "OWNER",
      );

      if (!owner) {
        taskResults.push({
          taskId: task.id,
          taskTitle: task.title,
          taskCode: task.code,
          priority: task.priority,
          estDays: task.estDays,
          deadline: task.deadline.toISOString(),
          suggestedOwner: null,
          suggestedSupport: null,
          reason: "Không có thành viên còn đủ capacity",
        });
        continue;
      }

      const supportEligible = scored
        .filter((candidate) => {
          if (candidate.id === owner.id) return false;
          const currentTasks = simulatedTaskCountMap.get(candidate.id) ?? 0;
          return (
            candidate.activeTaskDays +
                addedDays * SUPPORT_WORKLOAD_FACTOR <=
              group.maxWorkloadDays &&
            (group.maxActiveTasks === null || currentTasks < group.maxActiveTasks)
          );
        })
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      const unusedSupport = supportEligible.find(
        (candidate) => !participatingMemberIds.has(candidate.id),
      );
      const support =
        group.requireAllMembers && unusedSupport
          ? unusedSupport
          : supportEligible[0] ?? null;

      simulatedWorkloadMap.set(
        owner.id,
        (simulatedWorkloadMap.get(owner.id) ?? 0) + addedDays,
      );
      simulatedTaskCountMap.set(
        owner.id,
        (simulatedTaskCountMap.get(owner.id) ?? 0) + 1,
      );
      participatingMemberIds.add(owner.id);

      if (support) {
        simulatedWorkloadMap.set(
          support.id,
          (simulatedWorkloadMap.get(support.id) ?? 0) +
            addedDays * SUPPORT_WORKLOAD_FACTOR,
        );
        simulatedTaskCountMap.set(
          support.id,
          (simulatedTaskCountMap.get(support.id) ?? 0) + 1,
        );
        participatingMemberIds.add(support.id);
      }
      allocatedCount++;

      const reasons = this.buildFallbackReasons(
        owner,
        task.module,
        group.maxWorkloadDays,
      );
      taskResults.push({
        taskId: task.id,
        taskTitle: task.title,
        taskCode: task.code,
        priority: task.priority,
        estDays: task.estDays,
        deadline: task.deadline.toISOString(),
        suggestedOwner: {
          id: owner.id,
          name: owner.fullName,
          position: owner.position?.name ?? null,
          compatibilityScore: owner.compatibilityScore,
          workloadDays: owner.activeTaskDays,
        },
        suggestedSupport: support
          ? {
              id: support.id,
              name: support.fullName,
              position: support.position?.name ?? null,
              compatibilityScore: support.compatibilityScore,
              workloadDays: support.activeTaskDays,
            }
          : null,
        reason: reasons.join(" • "),
      });
    }

    if (
      group.requireAllMembers &&
      participatingMemberIds.size !== baseCandidates.length
    ) {
      throw new AppError(
        "Không thể sử dụng đủ thành viên với deadline và giới hạn capacity hiện tại.",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    return {
      taskGroupId: group.id,
      taskGroupName: group.name,
      department: group.department,
      tasks: taskResults,
      summary: {
        totalUnassignedTasks: unassignedTasks.length,
        totalAllocated: allocatedCount,
        unallocatableTasks: unassignedTasks.length - allocatedCount,
        internsEvaluatedCount: baseCandidates.length,
        membersUsedCount: participatingMemberIds.size,
        totalMemberCount: baseCandidates.length,
      },
    };
  }

  async confirmGroupAllocation(
    taskGroupId: string,
    payload: ConfirmGroupAllocationPayloadDto,
    user: UserPayload,
  ) {
    const group = await prisma.taskGroup.findUnique({
      where: { id: taskGroupId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        maxWorkloadDays: true,
        maxActiveTasks: true,
        requireAllMembers: true,
      },
    });
    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const taskIds = payload.assignments.map((item) => item.taskId);
    if (new Set(taskIds).size !== taskIds.length) {
      throw new AppError(
        "Danh sách phân công chứa task bị trùng",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const eligibleMembers = await prisma.intern.findMany({
      where: {
        taskGroupMemberships: { some: { taskGroupId } },
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
        ...(group.departmentId ? { departmentId: group.departmentId } : {}),
        ...(user.role === ROLES.LEADER ? { leaderId: user.id } : {}),
      },
      select: { id: true, userId: true, fullName: true },
    });
    const eligibleMemberIds = new Set(eligibleMembers.map((member) => member.id));

    for (const item of payload.assignments) {
      if (!eligibleMemberIds.has(item.internId)) {
        throw new AppError(
          "Owner phải là thành viên active của Task Group và thuộc quyền quản lý của bạn",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
      if (item.supportId && !eligibleMemberIds.has(item.supportId)) {
        throw new AppError(
          "Support phải là thành viên active của Task Group và thuộc quyền quản lý của bạn",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
      if (item.supportId === item.internId) {
        throw new AppError(
          "Owner và Support phải là hai TTS khác nhau",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, taskGroupId, deletedAt: null },
      select: {
        id: true,
        title: true,
        deadline: true,
        estDays: true,
        assignment: { select: { id: true, internId: true } },
      },
    });
    if (tasks.length !== taskIds.length) {
      throw new AppError(
        "Có task không tồn tại hoặc không thuộc Task Group",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) {
      if (task.assignment?.internId) {
        throw new AppError(
          `Task "${task.title}" đã được phân công`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
      const deadlineDay = new Date(task.deadline);
      deadlineDay.setHours(23, 59, 59, 999);
      if (deadlineDay < new Date()) {
        throw new AppError(
          `Task "${task.title}" đã quá hạn`,
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    const activeAssignments = await prisma.taskAssignment.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
        task: { deletedAt: null },
        OR: [
          { internId: { in: [...eligibleMemberIds] } },
          { supportId: { in: [...eligibleMemberIds] } },
        ],
      },
      select: {
        internId: true,
        supportId: true,
        task: { select: { estDays: true } },
      },
    });

    const workloadMap = new Map<string, number>();
    const taskCountMap = new Map<string, number>();
    eligibleMemberIds.forEach((id) => {
      workloadMap.set(id, 0);
      taskCountMap.set(id, 0);
    });
    for (const assignment of activeAssignments) {
      const days = assignment.task.estDays ?? 3;
      if (assignment.internId && eligibleMemberIds.has(assignment.internId)) {
        workloadMap.set(
          assignment.internId,
          (workloadMap.get(assignment.internId) ?? 0) + days,
        );
        taskCountMap.set(
          assignment.internId,
          (taskCountMap.get(assignment.internId) ?? 0) + 1,
        );
      }
      if (assignment.supportId && eligibleMemberIds.has(assignment.supportId)) {
        workloadMap.set(
          assignment.supportId,
          (workloadMap.get(assignment.supportId) ?? 0) +
            days * SUPPORT_WORKLOAD_FACTOR,
        );
        taskCountMap.set(
          assignment.supportId,
          (taskCountMap.get(assignment.supportId) ?? 0) + 1,
        );
      }
    }

    const participatingMemberIds = new Set<string>();
    for (const item of payload.assignments) {
      const task = taskById.get(item.taskId)!;
      const days = task.estDays ?? 3;
      const nextOwnerWorkload = (workloadMap.get(item.internId) ?? 0) + days;
      const nextOwnerTaskCount = (taskCountMap.get(item.internId) ?? 0) + 1;
      if (
        nextOwnerWorkload > group.maxWorkloadDays ||
        (group.maxActiveTasks !== null &&
          nextOwnerTaskCount > group.maxActiveTasks)
      ) {
        throw new AppError(
          `Owner của task "${task.title}" vượt giới hạn capacity`,
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      workloadMap.set(item.internId, nextOwnerWorkload);
      taskCountMap.set(item.internId, nextOwnerTaskCount);
      participatingMemberIds.add(item.internId);

      if (item.supportId) {
        const nextSupportWorkload =
          (workloadMap.get(item.supportId) ?? 0) +
          days * SUPPORT_WORKLOAD_FACTOR;
        const nextSupportTaskCount = (taskCountMap.get(item.supportId) ?? 0) + 1;
        if (
          nextSupportWorkload > group.maxWorkloadDays ||
          (group.maxActiveTasks !== null &&
            nextSupportTaskCount > group.maxActiveTasks)
        ) {
          throw new AppError(
            `Support của task "${task.title}" vượt giới hạn capacity`,
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
        workloadMap.set(item.supportId, nextSupportWorkload);
        taskCountMap.set(item.supportId, nextSupportTaskCount);
        participatingMemberIds.add(item.supportId);
      }
    }

    if (
      group.requireAllMembers &&
      participatingMemberIds.size !== eligibleMemberIds.size
    ) {
      throw new AppError(
        "Cấu hình Task Group yêu cầu tất cả thành viên phải tham gia ít nhất một task",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const notifications: { userId: string; taskTitle: string; deadline: Date }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of payload.assignments) {
        const task = await tx.task.findFirst({
          where: { id: item.taskId, taskGroupId, deletedAt: null },
          select: {
            id: true,
            title: true,
            deadline: true,
            assignment: { select: { id: true, internId: true } },
          },
        });

        if (!task || task.assignment?.internId) {
          throw new AppError(
            "Dữ liệu phân công đã thay đổi. Vui lòng tạo lại đề xuất.",
            409,
            ERROR_CODE.DUPLICATE_ENTRY,
          );
        }

        if (task.assignment) {
          await tx.taskAssignment.update({
            where: { id: task.assignment.id },
            data: {
              internId: item.internId,
              supportId: item.supportId || null,
              assignedBy: user.id,
              status: "TODO",
            },
          });
        } else {
          await tx.taskAssignment.create({
            data: {
              taskId: item.taskId,
              internId: item.internId,
              supportId: item.supportId || null,
              assignedBy: user.id,
              status: "TODO",
            },
          });
        }
        const owner = eligibleMembers.find((member) => member.id === item.internId)!;
        notifications.push({
          userId: owner.userId,
          taskTitle: task.title,
          deadline: task.deadline,
        });
      }
    });

    for (const notification of notifications) {
      try {
        await NotificationDispatcher.dispatch(
          notification.userId,
          "TASK_ASSIGNMENT",
          {
            taskTitle: notification.taskTitle,
            deadline: notification.deadline.toLocaleDateString("vi-VN"),
          },
        );
      } catch (error) {
        console.error("Failed to dispatch bulk assignment notification:", error);
      }
    }

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.ASSIGN_TASK,
      `Phân công hàng loạt ${payload.assignments.length} task cho nhóm ${group.name}`,
      group.id,
      "TaskGroup",
    );

    return {
      success: true,
      message: `Đã hoàn tất phân công ${payload.assignments.length} task cho nhóm công việc.`,
      count: payload.assignments.length,
    };
  }
}
