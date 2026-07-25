import fs from "fs";
import path from "path";
import { appConfig } from "../../config/app.config";

// Dữ liệu hiệu suất Task trong tuần
export interface TaskPerformanceItem {
  title: string;
  code: string | null;
  status: string;
  isDone: boolean;
  submissionCount: number;
}

// Thống kê hiệu suất tổng quan
export interface PerformanceSummary {
  taskTotal: number;
  taskCompleted: number;
  taskCompletionRate: number;
  dailyReportTotal: number;
  submissionTotal: number;
  rejectedTotal: number;
  avgAttemptsPerTask: number;
}

// Một chỉ số điểm số để so sánh Leader vs AI
export interface ScoreComparisonRow {
  label: string;
  leaderScore: number;
  aiScore: number | null;
  delta: string | null;
  deltaPositive: boolean;
}

// Progress bar cho mỗi chỉ số điểm
export interface ScoreBar {
  label: string;
  score: number;
  percentage: number;
}

// Xu hướng tiến bộ so với tuần trước
export interface ProgressTrend {
  label: string;
  current: number;
  previous: number;
  delta: string;
  isUp: boolean;
  isDown: boolean;
}

// Row trong bảng 12 tiêu chí
export interface CriteriaRow {
  index: number;
  label: string;
  rating: string;      // "Tốt", "Khá", ...
  ratingCode: string;  // "TOT", "KHA", ...
  score: number;
  aiRating: string | null;
  aiRatingCode: string | null;
  isDiff: boolean;     // Leader khác AI
}

// Section trong bảng 12 tiêu chí
export interface CriteriaSection {
  id: string;
  label: string;
  criteria: CriteriaRow[];
  avgScore: number;
}

const RATING_LABELS: Record<string, string> = {
  TOT: "Tốt", KHA: "Khá", TB: "Trung bình", TBY: "Trung bình yếu", YEU: "Yếu",
};
const RATING_SCORES: Record<string, number> = {
  TOT: 10, KHA: 8, TB: 6, TBY: 4, YEU: 2,
};

const CRITERIA_SECTIONS_META = [
  {
    id: "I",
    label: "Kỷ luật và tư chất",
    criteria: [
      { key: "ruleCompliance",   label: "Thực hiện nội quy của cơ quan" },
      { key: "workAttitude",     label: "Thái độ làm việc" },
      { key: "learningCapacity", label: "Năng lực tiếp thu" },
      { key: "resilience",       label: "Khả năng vượt khó, chịu áp lực" },
      { key: "communication",    label: "Giao tiếp và ứng xử" },
    ],
  },
  {
    id: "II",
    label: "Khả năng chuyên môn",
    criteria: [
      { key: "knowledge",        label: "Kiến thức" },
      { key: "practicalSkills",  label: "Kỹ năng thực hành" },
      { key: "foreignLanguage",  label: "Năng lực ngoại ngữ" },
      { key: "teamwork",         label: "Kỹ năng làm việc nhóm" },
      { key: "creativity",       label: "Tính sáng tạo" },
    ],
  },
  {
    id: "III",
    label: "Kết quả thực hiện đề tài",
    criteria: [
      { key: "contentQuality",   label: "Thực hiện yêu cầu về nội dung" },
      { key: "progressDelivery", label: "Thực hiện yêu cầu về tiến độ" },
    ],
  },
];

export class WeeklyEvaluationPdfDTO {
  // Header
  id: string;
  week: number;
  weekRange: string;
  generatedAt: string;
  logoBase64?: string;

  // Thông tin thực tập sinh
  internName: string;
  internCode: string;
  department: string;
  position: string;
  internStartDate: string;

  // Thông tin Leader
  leaderName: string;
  leaderPosition: string;

  // Điểm số thô (4 nhóm kế thừa)
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  totalScore: number;
  comment: string;

  // New: có 12-criteria ratings?
  hasRatings: boolean;
  criteriaSections: CriteriaSection[];

  // AI raw comment
  aiComment: string;
  hasAiEvaluation: boolean;
  aiGeneratedAt: string;

  // AI phân tích có cấu trúc (parse từ aiComment)
  aiStrengths: string[];
  aiImprovements: string[];
  aiRecommendation: string;

  // Bảng so sánh Leader vs AI (4 nhóm điểm cũ, chỉ khi không có 12 tiêu chí)
  scoreComparison: ScoreComparisonRow[];

  // Progress bars
  scoreBars: ScoreBar[];

  // Thống kê hiệu suất
  performance: PerformanceSummary;

  // Danh sách task trong tuần
  tasks: TaskPerformanceItem[];

  // So sánh với tuần trước
  hasPreviousWeek: boolean;
  progressTrends: ProgressTrend[];
  progressSummary: string;

  // QR Code xác thực
  qrCodeUrl: string;

  constructor(raw: any, prevWeek: any | null, stats: {
    taskTotal: number;
    taskCompleted: number;
    taskItems: TaskPerformanceItem[];
    dailyReportTotal: number;
    submissionTotal: number;
    rejectedTotal: number;
  }) {
    this.id = raw.id;
    this.week = raw.week;

    const internStart = new Date(raw.intern?.startDate || raw.createdAt);
    const weekStartMs = internStart.getTime() + (raw.week - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekStart = new Date(weekStartMs);
    const weekEnd = new Date(weekStartMs + 6 * 24 * 60 * 60 * 1000);
    this.weekRange = `${this.formatDate(weekStart)} – ${this.formatDate(weekEnd)}`;

    this.generatedAt = new Date().toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const logoPath = path.join(process.cwd(), 'templates', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuf = fs.readFileSync(logoPath);
      this.logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
    }

    this.internName = raw.intern?.fullName || raw.intern?.user?.fullName || 'N/A';
    this.internCode = raw.intern?.id ? `INT-${raw.intern.id.substring(0, 8).toUpperCase()}` : 'N/A';
    this.department = raw.intern?.department?.name || raw.intern?.department || 'N/A';
    this.position = raw.intern?.position?.name || raw.intern?.position || 'N/A';
    this.internStartDate = raw.intern?.startDate ? this.formatDate(new Date(raw.intern.startDate)) : 'N/A';

    this.leaderName = raw.leader?.fullName || 'N/A';
    this.leaderPosition = 'Team Leader';

    this.communication = raw.communication || 0;
    this.attitude = raw.attitude || 0;
    this.learning = raw.learning || 0;
    this.coding = raw.coding || 0;
    this.totalScore = raw.totalScore || 0;
    this.comment = raw.comment || 'Chưa có nhận xét định tính từ Leader.';

    // ── 12-criteria ratings ──────────────────────────────
    const ratingsRaw = raw.ratings;
    const aiRatingsRaw = raw.aiRatings;
    this.hasRatings = !!ratingsRaw && typeof ratingsRaw === 'object';

    this.criteriaSections = this.hasRatings
      ? CRITERIA_SECTIONS_META.map(section => {
          const rows: CriteriaRow[] = section.criteria.map((c, idx) => {
            const ratingCode: string = ratingsRaw[c.key] || 'TB';
            const aiCode: string | null = aiRatingsRaw ? (aiRatingsRaw[c.key] || null) : null;
            return {
              index: idx + 1,
              label: c.label,
              rating: RATING_LABELS[ratingCode] || ratingCode,
              ratingCode,
              score: RATING_SCORES[ratingCode] || 6,
              aiRating: aiCode ? (RATING_LABELS[aiCode] || aiCode) : null,
              aiRatingCode: aiCode,
              isDiff: !!aiCode && aiCode !== ratingCode,
            };
          });
          const avgScore = parseFloat(
            (rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1)
          );
          return { id: section.id, label: section.label, criteria: rows, avgScore };
        })
      : [];

    // ── AI ───────────────────────────────────────────────
    this.aiComment = raw.aiComment || '';
    this.hasAiEvaluation = !!raw.aiComment || !!aiRatingsRaw;
    this.aiGeneratedAt = raw.aiGeneratedAt ? this.formatDate(new Date(raw.aiGeneratedAt)) : 'N/A';

    const parsed = this.parseAiComment(raw.aiComment || '');
    this.aiStrengths = parsed.strengths;
    this.aiImprovements = parsed.improvements;
    this.aiRecommendation = parsed.recommendation;

    // ── Score comparison (legacy 4-criteria) ─────────────
    const aiComm  = raw.aiCommunication ?? null;
    const aiAtt   = raw.aiAttitude ?? null;
    const aiLearn = raw.aiLearning ?? null;
    const aiCode  = raw.aiCoding ?? null;

    this.scoreComparison = [
      this.buildRow('Giao tiếp (Communication)', this.communication, aiComm),
      this.buildRow('Thái độ (Attitude)',      this.attitude,      aiAtt),
      this.buildRow('Tự học (Learning)',      this.learning,      aiLearn),
      this.buildRow('Lập trình (Coding)',        this.coding,        aiCode),
    ];

    // ── Score bars ───────────────────────────────────────
    this.scoreBars = [
      { label: 'Giao tiếp (Communication)', score: this.communication, percentage: this.communication * 10 },
      { label: 'Thái độ (Attitude)',      score: this.attitude,      percentage: this.attitude * 10 },
      { label: 'Tự học (Learning)',      score: this.learning,      percentage: this.learning * 10 },
      { label: 'Lập trình (Coding)',        score: this.coding,        percentage: this.coding * 10 },
    ];

    // ── Performance stats ────────────────────────────────
    const avgAttempts = stats.taskCompleted > 0
      ? parseFloat((stats.submissionTotal / Math.max(stats.taskCompleted, 1)).toFixed(1))
      : 0;

    this.performance = {
      taskTotal: stats.taskTotal,
      taskCompleted: stats.taskCompleted,
      taskCompletionRate: stats.taskTotal > 0
        ? Math.round((stats.taskCompleted / stats.taskTotal) * 100) : 0,
      dailyReportTotal: stats.dailyReportTotal,
      submissionTotal: stats.submissionTotal,
      rejectedTotal: stats.rejectedTotal,
      avgAttemptsPerTask: avgAttempts,
    };

    this.tasks = stats.taskItems;

    // ── Progress trends ───────────────────────────────────
    this.hasPreviousWeek = !!prevWeek;
    if (prevWeek) {
      this.progressTrends = [
        this.buildTrend('Giao tiếp',     this.communication, prevWeek.communication),
        this.buildTrend('Thái độ',      this.attitude,      prevWeek.attitude),
        this.buildTrend('Tự học',       this.learning,      prevWeek.learning),
        this.buildTrend('Lập trình',    this.coding,        prevWeek.coding),
      ];
      const overallDelta = this.totalScore - prevWeek.totalScore;
      this.progressSummary = overallDelta >= 0
        ? `Điểm tổng tăng ${overallDelta.toFixed(1)} điểm so với Tuần ${prevWeek.week}.`
        : `Điểm tổng giảm ${Math.abs(overallDelta).toFixed(1)} điểm so với Tuần ${prevWeek.week}. Cần theo dõi sát hơn.`;
    } else {
      this.progressTrends = [];
      this.progressSummary = 'Đây là tuần đánh giá đầu tiên của thực tập sinh.';
    }

    // ── QR ───────────────────────────────────────────────
    const baseUrl = (appConfig.baseUrl || 'http://localhost:3000').replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/leader/weekly-evaluation/${raw.id}`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`;
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private buildRow(label: string, leader: number, ai: number | null): ScoreComparisonRow {
    if (ai === null) {
      return { label, leaderScore: leader, aiScore: null, delta: null, deltaPositive: false };
    }
    const diff = parseFloat((leader - ai).toFixed(1));
    return {
      label, leaderScore: leader, aiScore: ai,
      delta: diff >= 0 ? `+${diff}` : `${diff}`,
      deltaPositive: diff >= 0,
    };
  }

  private buildTrend(label: string, current: number, previous: number): ProgressTrend {
    const diff = parseFloat((current - previous).toFixed(1));
    return {
      label, current, previous,
      delta: diff >= 0 ? `▲ +${diff}` : `▼ ${diff}`,
      isUp: diff > 0, isDown: diff < 0,
    };
  }

  private parseAiComment(text: string): {
    strengths: string[];
    improvements: string[];
    recommendation: string;
  } {
    if (!text) return { strengths: [], improvements: [], recommendation: '' };

    const strengthMatch  = text.match(/(?:điểm mạnh|strengths?)[:\s]+([^]+?)(?=điểm cần|cần cải thiện|improvements?|khuyến nghị|recommendations?|$)/i);
    const improveMatch   = text.match(/(?:cần cải thiện|improvements?)[:\s]+([^]+?)(?=khuyến nghị|recommendations?|$)/i);
    const recommendMatch = text.match(/(?:khuyến nghị|recommendations?)[:\s]+([^]+?)$/i);

    const extractBullets = (raw: string | undefined): string[] => {
      if (!raw) return [];
      return raw.trim().split(/\n|•|-|\d+\./).map(s => s.trim()).filter(s => s.length > 5).slice(0, 4);
    };

    if (strengthMatch || improveMatch) {
      return {
        strengths:      extractBullets(strengthMatch?.[1]),
        improvements:   extractBullets(improveMatch?.[1]),
        recommendation: recommendMatch?.[1]?.trim() || '',
      };
    }

    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
    const third = Math.ceil(sentences.length / 3);
    return {
      strengths:      sentences.slice(0, third).map(s => s.trim()),
      improvements:   sentences.slice(third, third * 2).map(s => s.trim()),
      recommendation: sentences.slice(third * 2).join('. ').trim(),
    };
  }
}
