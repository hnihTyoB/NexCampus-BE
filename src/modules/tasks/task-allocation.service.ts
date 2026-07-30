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
function calculateWorkloadScore(activeTaskDays: number): number {
  if (activeTaskDays <= 0) return 100;
  if (activeTaskDays >= MAX_WORKLOAD_DAYS) return 0;
  return Math.round((1 - activeTaskDays / MAX_WORKLOAD_DAYS) * 100);
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

function computeRiskLevel(ownerActiveTaskDays: number): "LOW" | "MEDIUM" | "HIGH" {
  const util = ownerActiveTaskDays / MAX_WORKLOAD_DAYS;
  if (util >= HIGH_RISK_THRESHOLD) return "HIGH";
  if (util >= MEDIUM_RISK_THRESHOLD) return "MEDIUM";
  return "LOW";
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class TaskAllocationService {
  private readonly aiService = new TaskAllocationAiService();

  async getAiRecommendation(
    taskId: string,
    user: UserPayload,
  ): Promise<AiRecommendationResponseDto> {
    // ── 1. Lấy Task info ────────────────────────────────────────────────────
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
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
        leaderId: user.id,
        status: "ACTIVE",
        deletedAt: null,
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
            status: "DONE",
            task: { deletedAt: null },
          },
          select: { task: { select: { module: true, phase: true } } },
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
      // Tổng estDays đang gánh
      const activeTaskDays = intern.assignments.reduce(
        (sum, a) => sum + (a.task.estDays ?? 3), // default 3 nếu null
        0,
      );

      // Evaluation gần nhất
      const latestEval = intern.weeklyEvaluations[0] ?? null;

      // Completed modules: từ cả assigned tasks (owner) và supported tasks
      const ownerCompleted = completedAssignmentsByIntern[idx];
      const supportCompleted = intern.supportedAssignments;
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
        activeTaskCount: intern.assignments.length,
        latestCodingScore: latestEval?.coding ?? null,
        latestLearningScore: latestEval?.learning ?? null,
        completedModules: [...new Set(completedModules)],
        completedPhases: [...new Set(completedPhases)],
      };
    });

    // ── 4. Tính điểm mỗi intern ──────────────────────────────────────────────
    const taskModule = task.module;
    const taskPhase = task.phase;

    const scoredCandidates: ScoredCandidate[] = candidates.map((intern) => {
      const workloadScore    = calculateWorkloadScore(intern.activeTaskDays);
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
        reasons: this.buildFallbackReasons(owner, taskModule),
        riskLevel: computeRiskLevel(ownerLoad),
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

  private buildFallbackReasons(owner: ScoredCandidate, taskModule: string | null): string[] {
    const reasons: string[] = [];

    if (owner.workloadScore >= 70) {
      reasons.push(`Workload thấp - đang gánh ${owner.activeTaskDays} ngày công`);
    } else if (owner.workloadScore >= 40) {
      reasons.push(`Workload ở mức vừa phải - còn ${MAX_WORKLOAD_DAYS - owner.activeTaskDays} ngày trống`);
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

    // 3. Lấy danh sách intern thuộc leader (và thuộc department của group nếu group có departmentId)
    const rawInterns = await prisma.intern.findMany({
      where: {
        leaderId: user.id,
        status: "ACTIVE",
        deletedAt: null,
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
            status: "DONE",
            task: { deletedAt: null },
          },
          select: { task: { select: { module: true, phase: true } } },
        },
      },
    });

    if (rawInterns.length === 0) {
      const msg = group.department?.name
        ? `Không tìm thấy intern active nào của bạn thuộc phòng ban "${group.department.name}".`
        : "Không tìm thấy intern active nào dưới sự quản lý của bạn.";
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
      const activeTaskDays = intern.assignments.reduce(
        (sum, a) => sum + (a.task.estDays ?? 3),
        0,
      );
      const latestEval = intern.weeklyEvaluations[0] ?? null;
      const ownerCompleted = completedAssignmentsByIntern[idx];
      const supportCompleted = intern.supportedAssignments;
      const allCompleted = [...ownerCompleted, ...supportCompleted];

      return {
        id: intern.id,
        fullName: intern.fullName,
        position: intern.position,
        department: intern.department,
        activeTaskDays,
        activeTaskCount: intern.assignments.length,
        latestCodingScore: latestEval?.coding ?? null,
        latestLearningScore: latestEval?.learning ?? null,
        completedModules: [...new Set(allCompleted.map((a) => a.task.module).filter((m): m is string => !!m))],
        completedPhases: [...new Set(allCompleted.map((a) => a.task.phase).filter((p): p is string => !!p))],
      };
    });

    const simulatedWorkloadMap = new Map<string, number>();
    baseCandidates.forEach((c) => simulatedWorkloadMap.set(c.id, c.activeTaskDays));

    const taskResults: GroupTaskAiRecommendationItemDto[] = [];
    let allocatedCount = 0;

    for (const t of unassignedTasks) {
      const scored: ScoredCandidate[] = baseCandidates.map((intern) => {
        const curWorkload = simulatedWorkloadMap.get(intern.id) ?? intern.activeTaskDays;
        const workloadScore = calculateWorkloadScore(curWorkload);
        const skillScore = calculateSkillScore(intern, t.module, t.phase);
        const performanceScore = calculatePerformanceScore(intern.latestCodingScore, intern.latestLearningScore);
        const learningScore = calculateLearningScore(intern, t.module, t.phase);
        const compatibilityScore = calculateCompatibilityScore({
          workload: workloadScore,
          skill: skillScore,
          performance: performanceScore,
          learning: learningScore,
        });

        return {
          ...intern,
          activeTaskDays: curWorkload,
          workloadScore,
          skillScore,
          performanceScore,
          learningScore,
          compatibilityScore,
          suggestedRole: "OWNER" as const,
        };
      });

      const ranked = [...scored].sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      const withRoles = assignOwnerSupportRoles(ranked);

      const owner = withRoles.find((c) => c.suggestedRole === "OWNER");
      const support = withRoles.find((c) => c.suggestedRole === "SUPPORT" && c !== owner);

      if (owner) {
        const addedDays = t.estDays ?? 3;
        simulatedWorkloadMap.set(owner.id, (simulatedWorkloadMap.get(owner.id) ?? 0) + addedDays);
        allocatedCount++;

        const reasons = this.buildFallbackReasons(owner, t.module);

        taskResults.push({
          taskId: t.id,
          taskTitle: t.title,
          taskCode: t.code,
          priority: t.priority,
          estDays: t.estDays,
          deadline: t.deadline.toISOString(),
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
      } else {
        taskResults.push({
          taskId: t.id,
          taskTitle: t.title,
          taskCode: t.code,
          priority: t.priority,
          estDays: t.estDays,
          deadline: t.deadline.toISOString(),
          suggestedOwner: null,
          suggestedSupport: null,
          reason: "Không có ứng viên phù hợp",
        });
      }
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
      },
    };
  }

  async confirmGroupAllocation(
    taskGroupId: string,
    payload: ConfirmGroupAllocationPayloadDto,
    user: UserPayload,
  ) {
    if (!payload.assignments || payload.assignments.length === 0) {
      throw new AppError("Danh sách phân công rỗng", 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const group = await prisma.taskGroup.findUnique({
      where: { id: taskGroupId },
      select: { id: true },
    });
    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }

    let createdCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of payload.assignments) {
        if (!item.taskId || !item.internId) continue;

        const task = await tx.task.findFirst({
          where: { id: item.taskId, taskGroupId, deletedAt: null },
          select: { id: true, assignment: { select: { id: true, internId: true } } },
        });

        if (!task) continue;
        if (task.assignment?.internId) continue; // Bỏ qua nếu task đã được phân công intern rồi

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
        createdCount++;
      }
    });

    return {
      success: true,
      message: `Đã hoàn tất phân công ${createdCount} task cho nhóm công việc.`,
      count: createdCount,
    };
  }
}
