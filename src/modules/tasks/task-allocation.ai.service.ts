import {
  TaskAllocationInputDto,
  TaskAllocationResultDto,
  RiskLevel,
} from "./task.dto";

export class TaskAllocationAiService {
  /**
   * Tính toán và gợi ý phân công công việc dựa trên đặc tả chuẩn trong task-allocation-rules.json:
   * - candidateWorkload = currentActiveDays + (role === 'OWNER' ? task.estDays : task.estDays * 0.5)
   * - Ngưỡng risk: >= 0.8 * maxWorkloadDays -> HIGH; >= 0.5 -> MEDIUM; < 0.5 -> LOW.
   * - Trọng số tương thích: workload 30%, skill 25%, performance 25%, learning 20%.
   */
  evaluateAllocation(input: TaskAllocationInputDto): TaskAllocationResultDto {
    const { task, candidates } = input;
    const maxWorkloadDays = task.maxWorkloadDays || 10;
    const estDays = task.estDays || 1;

    const evaluatedCandidates = candidates.map((candidate) => {
      const workloadScore =
        candidate.workloadScore ??
        Math.max(0, Math.round(100 - (candidate.activeTaskDays / maxWorkloadDays) * 100));
      const skillScore =
        candidate.skillScore ??
        (candidate.completedModules?.includes(task.module || "") ? 90 : 70);
      const performanceScore =
        candidate.performanceScore ??
        (candidate.latestCodingScore ? Math.round(candidate.latestCodingScore * 10) : 75);
      const learningScore =
        candidate.learningScore ??
        (candidate.latestLearningScore ? Math.round(candidate.latestLearningScore * 10) : 80);

      const totalScore =
        candidate.compatibilityScore ??
        Math.round(
          workloadScore * 0.3 +
            skillScore * 0.25 +
            performanceScore * 0.25 +
            learningScore * 0.2,
        );

      const ownerWorkload = candidate.activeTaskDays + estDays;
      const ownerRisk: RiskLevel =
        ownerWorkload >= 0.8 * maxWorkloadDays
          ? "HIGH"
          : ownerWorkload >= 0.5 * maxWorkloadDays
            ? "MEDIUM"
            : "LOW";

      const supportWorkload = candidate.activeTaskDays + estDays * 0.5;
      const supportRisk: RiskLevel =
        supportWorkload >= 0.8 * maxWorkloadDays
          ? "HIGH"
          : supportWorkload >= 0.5 * maxWorkloadDays
            ? "MEDIUM"
            : "LOW";

      return {
        ...candidate,
        workloadScore,
        skillScore,
        performanceScore,
        learningScore,
        totalScore,
        ownerWorkload,
        ownerRisk,
        supportWorkload,
        supportRisk,
      };
    });

    const explicitOwner = evaluatedCandidates.find((c) => c.suggestedRole === "OWNER");
    const explicitSupport = evaluatedCandidates.find((c) => c.suggestedRole === "SUPPORT");

    let owner = explicitOwner;
    let support = explicitSupport;

    if (!owner) {
      const sortedByScore = [...evaluatedCandidates].sort((a, b) => b.totalScore - a.totalScore);
      owner = sortedByScore[0];
    }

    if (!support && evaluatedCandidates.length > 1) {
      const remaining = evaluatedCandidates.filter((c) => c.id !== owner?.id);
      const isMentorshipNeeded = (owner?.learningScore ?? 0) > (owner?.skillScore ?? 0);
      if (isMentorshipNeeded) {
        remaining.sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));
      } else {
        remaining.sort((a, b) => (b.workloadScore ?? 0) - (a.workloadScore ?? 0));
      }
      support = remaining[0] || null;
    }

    const recommendedOwnerId = owner ? owner.id : candidates[0].id;
    const recommendedSupportId = support ? support.id : null;
    const riskLevel: RiskLevel = owner ? owner.ownerRisk : "LOW";

    const ownerLoad = owner ? owner.ownerWorkload : estDays;
    const ownerPercent = Math.round((ownerLoad / maxWorkloadDays) * 100);
    const workloadAnalysis =
      riskLevel === "HIGH"
        ? `Cảnh báo quá tải: Khối lượng công việc dự kiến của ứng viên ${owner?.fullName} là ${ownerLoad.toFixed(1)} ngày (${ownerPercent}% hạn mức ${maxWorkloadDays} ngày), vượt 80% hạn mức tối đa cho phép. Cần theo dõi sát tiến độ hoặc cân nhắc giảm bớt task tồn đọng.`
        : riskLevel === "MEDIUM"
          ? `Khối lượng công việc của ${owner?.fullName} ở mức vừa phải (${ownerLoad.toFixed(1)} ngày, tương đương ${ownerPercent}% hạn mức ${maxWorkloadDays} ngày). Tiến độ trong ngưỡng kiểm soát.`
          : `Khối lượng công việc an toàn: Ứng viên ${owner?.fullName} hiện có nhiều ngày trống, thời gian thực hiện ước tính ${ownerLoad.toFixed(1)} ngày (${ownerPercent}% hạn mức ${maxWorkloadDays} ngày), còn nhiều dư địa hoàn thành đúng hạn.`;

    const isMentorshipPairing =
      support && ((owner?.learningScore ?? 0) >= 80 || owner?.suggestedRole === "OWNER");
    const learningOpportunity = isMentorshipPairing
      ? `Cơ hội kèm cặp và học hỏi: Task này giúp ứng viên ${owner?.fullName} thử sức nâng cao kỹ năng về module '${task.module || "hệ thống"}', được sự hỗ trợ và mentor từ ${support?.fullName} để đảm bảo chất lượng code.`
      : `Task mang lại cơ hội củng cố kỹ năng chuyên môn về ${task.module || "nghiệp vụ"} và tối ưu hiệu suất làm việc nhóm.`;

    const reasons: string[] = [];
    if (owner) {
      if ((owner.skillScore ?? 0) >= 80) {
        reasons.push(`Phù hợp chuyên môn và có kinh nghiệm module liên quan (${owner.skillScore}đ)`);
      } else {
        reasons.push("Được phân công để rèn luyện và tiếp thu kiến thức module mới");
      }
      if ((owner.performanceScore ?? 0) >= 80) {
        reasons.push(`Hiệu suất làm việc và chất lượng hoàn thành task tốt (${owner.performanceScore}đ)`);
      }
    }
    if (support) {
      reasons.push(`Hỗ trợ kỹ thuật và phối hợp mentor từ ${support.fullName}`);
    }

    const candidateRankings = evaluatedCandidates.map((c) => ({
      candidateId: c.id,
      fullName: c.fullName,
      estimatedWorkload: c.ownerWorkload,
      riskLevel: c.ownerRisk,
      compatibilityScore: c.totalScore,
    }));

    return {
      recommendedOwnerId,
      recommendedSupportId,
      riskLevel,
      workloadAnalysis,
      learningOpportunity,
      reasons,
      candidateRankings,
    };
  }
}

export const taskAllocationAiService = new TaskAllocationAiService();
