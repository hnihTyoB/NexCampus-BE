import fs from "fs";
import path from "path";

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
  delta: string | null; // e.g. "+0.5" hoặc "-0.3"
  deltaPositive: boolean;
}

// Progress bar cho mỗi chỉ số điểm
export interface ScoreBar {
  label: string;
  score: number;
  percentage: number; // 0-100
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

export class WeeklyEvaluationPdfDTO {
  // Header
  id: string;
  week: number;
  weekRange: string; // "14/07/2026 – 20/07/2026"
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
  leaderPosition: string; // Chức vụ của Leader

  // Điểm số thô
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  totalScore: number;
  comment: string;

  // AI raw comment
  aiComment: string;
  hasAiEvaluation: boolean;
  aiGeneratedAt: string;

  // AI phân tích có cấu trúc (parse từ aiComment)
  aiStrengths: string[];
  aiImprovements: string[];
  aiRecommendation: string;

  // Bảng so sánh Leader vs AI (với cột delta)
  scoreComparison: ScoreComparisonRow[];

  // Progress bars
  scoreBars: ScoreBar[];

  // Thống kê hiệu suất
  performance: PerformanceSummary;

  // Danh sách task trong tuần
  tasks: TaskPerformanceItem[];

  // So sánh với tuần trước (AI Progress Analysis)
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

    // Tính date range của tuần đánh giá dựa theo startDate của intern
    const internStart = new Date(raw.intern?.startDate || raw.createdAt);
    const weekStartMs = internStart.getTime() + (raw.week - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekStart = new Date(weekStartMs);
    const weekEnd = new Date(weekStartMs + 6 * 24 * 60 * 60 * 1000);
    this.weekRange = `${this.formatDate(weekStart)} – ${this.formatDate(weekEnd)}`;

    this.generatedAt = new Date().toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Logo base64
    const logoPath = path.join(process.cwd(), 'templates', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuf = fs.readFileSync(logoPath);
      this.logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
    }

    // Intern info
    this.internName = raw.intern?.fullName || raw.intern?.user?.fullName || 'N/A';
    this.internCode = raw.intern?.id ? `INT-${raw.intern.id.substring(0, 8).toUpperCase()}` : 'N/A';
    this.department = raw.intern?.department || 'N/A';
    this.position = raw.intern?.position || 'N/A';
    this.internStartDate = raw.intern?.startDate ? this.formatDate(new Date(raw.intern.startDate)) : 'N/A';

    // Leader info
    this.leaderName = raw.leader?.fullName || 'N/A';
    this.leaderPosition = 'Team Leader';

    // Scores
    this.communication = raw.communication || 0;
    this.attitude = raw.attitude || 0;
    this.learning = raw.learning || 0;
    this.coding = raw.coding || 0;
    this.totalScore = raw.totalScore || 0;
    this.comment = raw.comment || 'Chưa có nhận xét định tính từ Leader.';

    // AI
    this.aiComment = raw.aiComment || '';
    this.hasAiEvaluation = !!raw.aiComment;
    this.aiGeneratedAt = raw.aiGeneratedAt ? this.formatDate(new Date(raw.aiGeneratedAt)) : 'N/A';

    // Parse AI comment thành phần structured
    const parsed = this.parseAiComment(raw.aiComment || '');
    this.aiStrengths = parsed.strengths;
    this.aiImprovements = parsed.improvements;
    this.aiRecommendation = parsed.recommendation;

    // Bảng so sánh điểm Leader vs AI
    const aiComm = raw.aiCommunication ?? null;
    const aiAtt = raw.aiAttitude ?? null;
    const aiLearn = raw.aiLearning ?? null;
    const aiCode = raw.aiCoding ?? null;

    this.scoreComparison = [
      this.buildRow('Communication', this.communication, aiComm),
      this.buildRow('Attitude', this.attitude, aiAtt),
      this.buildRow('Learning', this.learning, aiLearn),
      this.buildRow('Coding', this.coding, aiCode),
    ];

    // Progress bars (dựa theo điểm Leader)
    this.scoreBars = [
      { label: 'Communication', score: this.communication, percentage: this.communication * 10 },
      { label: 'Attitude',      score: this.attitude,      percentage: this.attitude * 10 },
      { label: 'Learning',      score: this.learning,      percentage: this.learning * 10 },
      { label: 'Coding',        score: this.coding,        percentage: this.coding * 10 },
    ];

    // Performance stats
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

    // So sánh với tuần trước
    this.hasPreviousWeek = !!prevWeek;
    if (prevWeek) {
      this.progressTrends = [
        this.buildTrend('Communication', this.communication, prevWeek.communication),
        this.buildTrend('Attitude',      this.attitude,      prevWeek.attitude),
        this.buildTrend('Learning',      this.learning,      prevWeek.learning),
        this.buildTrend('Coding',        this.coding,        prevWeek.coding),
      ];
      const overallDelta = this.totalScore - prevWeek.totalScore;
      this.progressSummary = overallDelta >= 0
        ? `Điểm tổng tăng ${overallDelta.toFixed(1)} điểm so với Tuần ${prevWeek.week}.`
        : `Điểm tổng giảm ${Math.abs(overallDelta).toFixed(1)} điểm so với Tuần ${prevWeek.week}. Cần theo dõi sát hơn.`;
    } else {
      this.progressTrends = [];
      this.progressSummary = 'Đây là tuần đánh giá đầu tiên của thực tập sinh.';
    }

    // QR
    const verificationUrl = `https://nexcampus.edu.vn/verify/pdf/${raw.id}`;
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

  /**
   * Parse aiComment thành 3 phần: strengths, improvements, recommendation.
   * AI comment thường có dạng văn bản liên tục. Ta trích xuất theo keyword.
   */
  private parseAiComment(text: string): {
    strengths: string[];
    improvements: string[];
    recommendation: string;
  } {
    if (!text) {
      return { strengths: [], improvements: [], recommendation: '' };
    }

    // Thử parse theo format có section keyword (nếu AI viết đúng format)
    const strengthMatch = text.match(/(?:điểm mạnh|strengths?)[:\s]+([^]+?)(?=điểm cần|cần cải thiện|improvements?|khuyến nghị|recommendations?|$)/i);
    const improveMatch  = text.match(/(?:cần cải thiện|improvements?)[:\s]+([^]+?)(?=khuyến nghị|recommendations?|$)/i);
    const recommendMatch = text.match(/(?:khuyến nghị|recommendations?)[:\s]+([^]+?)$/i);

    const extractBullets = (raw: string | undefined): string[] => {
      if (!raw) return [];
      return raw.trim().split(/\n|•|-|\d+\./).map(s => s.trim()).filter(s => s.length > 5).slice(0, 4);
    };

    if (strengthMatch || improveMatch) {
      return {
        strengths: extractBullets(strengthMatch?.[1]),
        improvements: extractBullets(improveMatch?.[1]),
        recommendation: recommendMatch?.[1]?.trim() || '',
      };
    }

    // Fallback: Chia đều văn bản thành câu
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
    const third = Math.ceil(sentences.length / 3);
    return {
      strengths:   sentences.slice(0, third).map(s => s.trim()),
      improvements: sentences.slice(third, third * 2).map(s => s.trim()),
      recommendation: sentences.slice(third * 2).join('. ').trim(),
    };
  }
}
