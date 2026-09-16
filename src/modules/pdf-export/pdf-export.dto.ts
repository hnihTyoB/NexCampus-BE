import fs from "fs";
import path from "path";
import { envConfig } from "../../config/env.config";

export interface TaskPerformanceItem {
  title: string;
  code: string | null;
  status: string;
  isDone: boolean;
  submissionCount: number;
}

export interface PerformanceSummary {
  taskTotal: number;
  taskCompleted: number;
  taskCompletionRate: number;
  dailyReportTotal: number;
  submissionTotal: number;
  rejectedTotal: number;
  avgAttemptsPerTask: number;
}

export interface ScoreComparisonRow {
  label: string;
  leaderScore: number;
  aiScore: number | null;
  delta: string | null;
  deltaPositive: boolean;
}

export interface ScoreBar {
  label: string;
  score: number;
  percentage: number;
}

export interface ProgressTrend {
  label: string;
  current: number;
  previous: number;
  delta: string;
  isUp: boolean;
  isDown: boolean;
}

export interface CriteriaRow {
  index: number;
  label: string;
  rating: string;
  ratingCode: string;
  score: number;
  aiRating: string | null;
  aiRatingCode: string | null;
  isDiff: boolean;
}

export interface CriteriaSection {
  id: string;
  label: string;
  criteria: CriteriaRow[];
  avgScore: number;
}

const RATING_LABELS: Record<string, string> = {
  TOT: "Tốt",
  KHA: "Khá",
  TB: "Trung bình",
  TBY: "Trung bình yếu",
  YEU: "Yếu",
};

const RATING_SCORES: Record<string, number> = {
  TOT: 10,
  KHA: 8,
  TB: 6,
  TBY: 4,
  YEU: 2,
};

const CRITERIA_SECTIONS_META = [
  {
    id: "I",
    label: "Kỷ luật và tư chất",
    criteria: [
      { key: "ruleCompliance", label: "Thực hiện nội quy của cơ quan" },
      { key: "workAttitude", label: "Thái độ làm việc" },
      { key: "learningCapacity", label: "Năng lực tiếp thu" },
      { key: "resilience", label: "Khả năng vượt khó, chịu áp lực" },
      { key: "communication", label: "Giao tiếp và ứng xử" },
    ],
  },
  {
    id: "II",
    label: "Khả năng chuyên môn",
    criteria: [
      { key: "knowledge", label: "Kiến thức chuyên môn" },
      { key: "practicalSkills", label: "Kỹ năng thực hành" },
      { key: "foreignLanguage", label: "Năng lực ngoại ngữ" },
      { key: "teamwork", label: "Kỹ năng làm việc nhóm" },
      { key: "creativity", label: "Tính sáng tạo" },
    ],
  },
  {
    id: "III",
    label: "Kết quả thực hiện đề tài",
    criteria: [
      { key: "contentQuality", label: "Thực hiện yêu cầu về nội dung" },
      { key: "progressDelivery", label: "Thực hiện yêu cầu về tiến độ" },
    ],
  },
];

export class WeeklyEvaluationPdfDTO {
  id: string;
  week: number;
  weekRange: string;
  generatedAt: string;
  logoBase64?: string;

  internName: string;
  internCode: string;
  department: string;
  position: string;
  internStartDate: string;

  leaderName: string;
  leaderPosition: string;

  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  totalScore: number;
  comment: string;

  hasRatings: boolean;
  criteriaSections: CriteriaSection[];

  aiComment: string;
  hasAiEvaluation: boolean;
  aiGeneratedAt: string;

  aiStrengths: string[];
  aiImprovements: string[];
  aiRecommendation: string;

  scoreComparison: ScoreComparisonRow[];
  scoreBars: ScoreBar[];
  performance: PerformanceSummary;
  tasks: TaskPerformanceItem[];

  hasPreviousWeek: boolean;
  progressTrends: ProgressTrend[];
  progressSummary: string;
  qrCodeUrl: string;

  constructor(
    raw: any,
    prevWeek: any | null,
    stats: {
      taskTotal: number;
      taskCompleted: number;
      taskItems: TaskPerformanceItem[];
      dailyReportTotal: number;
      submissionTotal: number;
      rejectedTotal: number;
    }
  ) {
    this.id = raw.id;
    this.week = raw.week;

    const internStart = new Date(raw.intern?.startDate || raw.createdAt);
    const weekStartMs = internStart.getTime() + (raw.week - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekStart = new Date(weekStartMs);
    const weekEnd = new Date(weekStartMs + 6 * 24 * 60 * 60 * 1000);
    this.weekRange = `${this.formatDate(weekStart)} – ${this.formatDate(weekEnd)}`;

    this.generatedAt = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const logoPath = path.join(process.cwd(), "templates", "assets", "logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuf = fs.readFileSync(logoPath);
      this.logoBase64 = `data:image/png;base64,${logoBuf.toString("base64")}`;
    }

    this.internName = raw.intern?.fullName || raw.intern?.user?.fullName || "N/A";
    this.internCode = raw.intern?.internCode || (raw.intern?.id ? `INT-${raw.intern.id.substring(0, 8).toUpperCase()}` : "N/A");
    this.department = raw.intern?.department?.name || "N/A";
    this.position = raw.intern?.position?.name || "N/A";
    this.internStartDate = raw.intern?.startDate ? this.formatDate(new Date(raw.intern.startDate)) : "N/A";

    this.leaderName = raw.leader?.fullName || raw.leader?.name || "N/A";
    this.leaderPosition = "Team Leader";

    // 12 tiêu chí
    const ratingsRaw = raw.ratings || {};
    const aiRatingsRaw = raw.aiRatings || null;
    this.hasRatings = !!ratingsRaw && typeof ratingsRaw === "object" && Object.keys(ratingsRaw).length > 0;

    if (this.hasRatings) {
      this.criteriaSections = CRITERIA_SECTIONS_META.map((section) => {
        const rows: CriteriaRow[] = section.criteria.map((c, idx) => {
          const ratingCode: string = ratingsRaw[c.key] || "TB";
          const aiCode: string | null = aiRatingsRaw ? aiRatingsRaw[c.key] || null : null;
          return {
            index: idx + 1,
            label: c.label,
            rating: RATING_LABELS[ratingCode] || ratingCode,
            ratingCode,
            score: RATING_SCORES[ratingCode] || 6,
            aiRating: aiCode ? RATING_LABELS[aiCode] || aiCode : null,
            aiRatingCode: aiCode,
            isDiff: Boolean(aiCode && aiCode !== ratingCode),
          };
        });
        const avgScore = parseFloat(
          (rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1)
        );
        return { id: section.id, label: section.label, criteria: rows, avgScore };
      });
    } else {
      this.criteriaSections = [];
    }

    // Điểm tổng & 4 nhóm rút gọn
    this.totalScore = raw.score ?? raw.totalScore ?? 8.0;
    this.communication = ratingsRaw.communication ? RATING_SCORES[ratingsRaw.communication] || 8 : (raw.communication || 8);
    this.attitude = ratingsRaw.workAttitude ? RATING_SCORES[ratingsRaw.workAttitude] || 8 : (raw.attitude || 8);
    this.learning = ratingsRaw.learningCapacity ? RATING_SCORES[ratingsRaw.learningCapacity] || 8 : (raw.learning || 8);
    this.coding = ratingsRaw.practicalSkills ? RATING_SCORES[ratingsRaw.practicalSkills] || 8 : (raw.coding || 8);
    this.comment = raw.comment || "Thực tập sinh thể hiện thái độ học hỏi và hoàn thành nhiệm vụ.";

    // AI Evaluation
    this.aiComment = raw.aiComment || "";
    this.hasAiEvaluation = Boolean(raw.aiComment || raw.aiRatings || raw.aiScore);
    this.aiGeneratedAt = raw.createdAt ? this.formatDate(new Date(raw.createdAt)) : "N/A";

    this.aiStrengths = raw.aiStrengths?.length ? raw.aiStrengths : (raw.strengths || []);
    this.aiImprovements = raw.aiWeaknesses?.length ? raw.aiWeaknesses : (raw.weaknesses || []);
    this.aiRecommendation = raw.aiRecommendations?.length ? raw.aiRecommendations.join(". ") : (raw.comment || "");

    const aiComm = aiRatingsRaw?.communication ? RATING_SCORES[aiRatingsRaw.communication] : null;
    const aiAtt = aiRatingsRaw?.workAttitude ? RATING_SCORES[aiRatingsRaw.workAttitude] : null;
    const aiLearn = aiRatingsRaw?.learningCapacity ? RATING_SCORES[aiRatingsRaw.learningCapacity] : null;
    const aiCode = aiRatingsRaw?.practicalSkills ? RATING_SCORES[aiRatingsRaw.practicalSkills] : null;

    this.scoreComparison = [
      this.buildRow("Giao tiếp (Communication)", this.communication, aiComm),
      this.buildRow("Thái độ (Attitude)", this.attitude, aiAtt),
      this.buildRow("Tiếp thu (Learning)", this.learning, aiLearn),
      this.buildRow("Chuyên môn (Skills)", this.coding, aiCode),
    ];

    this.scoreBars = [
      { label: "Giao tiếp (Communication)", score: this.communication, percentage: this.communication * 10 },
      { label: "Thái độ (Attitude)", score: this.attitude, percentage: this.attitude * 10 },
      { label: "Tiếp thu (Learning)", score: this.learning, percentage: this.learning * 10 },
      { label: "Chuyên môn (Skills)", score: this.coding, percentage: this.coding * 10 },
    ];

    // Thống kê hiệu suất
    const avgAttempts =
      stats.taskCompleted > 0
        ? parseFloat((stats.submissionTotal / Math.max(stats.taskCompleted, 1)).toFixed(1))
        : 0;

    this.performance = {
      taskTotal: stats.taskTotal,
      taskCompleted: stats.taskCompleted,
      taskCompletionRate:
        stats.taskTotal > 0 ? Math.round((stats.taskCompleted / stats.taskTotal) * 100) : 0,
      dailyReportTotal: stats.dailyReportTotal,
      submissionTotal: stats.submissionTotal,
      rejectedTotal: stats.rejectedTotal,
      avgAttemptsPerTask: avgAttempts,
    };

    this.tasks = stats.taskItems;

    // So sánh với tuần trước
    this.hasPreviousWeek = Boolean(prevWeek);
    if (prevWeek) {
      const prevScore = prevWeek.score ?? prevWeek.totalScore ?? 0;
      this.progressTrends = [
        this.buildTrend("Điểm tổng", this.totalScore, prevScore),
      ];
      const overallDelta = this.totalScore - prevScore;
      this.progressSummary =
        overallDelta >= 0
          ? `Điểm tổng tăng ${overallDelta.toFixed(1)} điểm so với Tuần ${prevWeek.week}.`
          : `Điểm tổng giảm ${Math.abs(overallDelta).toFixed(1)} điểm so với Tuần ${prevWeek.week}.`;
    } else {
      this.progressTrends = [];
      this.progressSummary = "Đây là tuần đánh giá đầu tiên của thực tập sinh.";
    }

    // QR Code
    const baseUrl = (process.env.APP_BASE_URL || "https://nexcampus.edu.vn").replace(/\/$/, "");
    const verificationUrl = `${baseUrl}/evaluations/verify/${raw.id}`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`;
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  private buildRow(label: string, leader: number, ai: number | null): ScoreComparisonRow {
    if (ai === null) {
      return { label, leaderScore: leader, aiScore: null, delta: null, deltaPositive: false };
    }
    const diff = parseFloat((leader - ai).toFixed(1));
    return {
      label,
      leaderScore: leader,
      aiScore: ai,
      delta: diff >= 0 ? `+${diff}` : `${diff}`,
      deltaPositive: diff >= 0,
    };
  }

  private buildTrend(label: string, current: number, previous: number): ProgressTrend {
    const diff = parseFloat((current - previous).toFixed(1));
    return {
      label,
      current,
      previous,
      delta: diff >= 0 ? `▲ +${diff}` : `▼ ${diff}`,
      isUp: diff > 0,
      isDown: diff < 0,
    };
  }
}

export interface WeeklyEvaluationSummaryItem {
  week: number;
  dateRange: string;
  score: number;
  grade: string;
  gradeCode: string;
  comment: string;
}

export class InternshipSummaryPdfDTO {
  internId: string;
  internName: string;
  internCode: string;
  university: string;
  major: string;
  departmentName: string;
  positionName: string;
  startDateFormatted: string;
  endDateFormatted: string;
  leaderName: string;
  finalStatusLabel: string;
  avgScore: number;
  finalGrade: string;
  finalGradeCode: string;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  reportsTotal: number;
  weeklyEvaluations: WeeklyEvaluationSummaryItem[];
  finalAssessmentLeader: string;
  finalRecommendation: string;
  qrCodeUrl: string;

  constructor(intern: any, evaluations: any[], taskStats: { total: number; completed: number }, reportCount: number) {
    this.internId = intern.id;
    this.internName = intern.fullName;
    this.internCode = intern.internCode || `INT-${intern.id.substring(0, 8).toUpperCase()}`;
    this.university = intern.university || "Trường Đại học Công nghệ";
    this.major = intern.major || "Kỹ thuật Phần mềm";
    this.departmentName = intern.department?.name || "Công nghệ Thông tin";
    this.positionName = intern.position?.name || "Software Engineer Intern";

    const start = new Date(intern.startDate);
    const end = new Date(start.getTime() + (intern.duration || 3) * 30 * 24 * 60 * 60 * 1000);
    this.startDateFormatted = start.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    this.endDateFormatted = end.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    this.leaderName = intern.leader?.fullName || "Leader Phụ Trách";
    this.finalStatusLabel = intern.status === "COMPLETED" ? "ĐÃ HOÀN THÀNH" : "ĐANG THỰC TẬP";

    // Evals breakdown
    let totalScore = 0;
    this.weeklyEvaluations = evaluations.map((e) => {
      totalScore += e.score;
      const weekStartMs = start.getTime() + (e.week - 1) * 7 * 24 * 60 * 60 * 1000;
      const wStart = new Date(weekStartMs);
      const wEnd = new Date(weekStartMs + 6 * 24 * 60 * 60 * 1000);
      const dRange = `${wStart.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} - ${wEnd.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
      const gradeCode = e.grade || (e.score >= 9 ? "TOT" : e.score >= 7.5 ? "KHA" : e.score >= 5 ? "TB" : "YEU");
      return {
        week: e.week,
        dateRange: dRange,
        score: Number(e.score.toFixed(1)),
        grade: RATING_LABELS[gradeCode] || gradeCode,
        gradeCode,
        comment: e.comment || "Hoàn thành các mục tiêu công việc trong tuần.",
      };
    });

    const evalCount = evaluations.length;
    this.avgScore = evalCount > 0 ? Number((totalScore / evalCount).toFixed(1)) : 8.5;

    if (this.avgScore >= 9.0) {
      this.finalGrade = "Xuất sắc";
      this.finalGradeCode = "TOT";
    } else if (this.avgScore >= 8.0) {
      this.finalGrade = "Giỏi";
      this.finalGradeCode = "KHA";
    } else if (this.avgScore >= 6.5) {
      this.finalGrade = "Khá";
      this.finalGradeCode = "KHA";
    } else if (this.avgScore >= 5.0) {
      this.finalGrade = "Trung bình";
      this.finalGradeCode = "TB";
    } else {
      this.finalGrade = "Yếu";
      this.finalGradeCode = "YEU";
    }

    this.tasksCompleted = taskStats.completed;
    this.tasksTotal = taskStats.total;
    this.completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 100;
    this.reportsTotal = reportCount;

    this.finalAssessmentLeader =
      evaluations[0]?.comment ||
      "Thực tập sinh có thái độ cầu tiến, hòa nhập tốt với văn hóa công ty, nắm vững quy trình phát triển phần mềm và hoàn thành các nhiệm vụ đề ra.";
    this.finalRecommendation =
      "Khuyến nghị tuyển dụng chính thức hoặc xem xét trao cơ hội cộng tác lâu dài tại doanh nghiệp.";

    const baseUrl = (process.env.APP_BASE_URL || "https://nexcampus.edu.vn").replace(/\/$/, "");
    const verificationUrl = `${baseUrl}/certificates/verify/${intern.id}`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`;
  }
}
