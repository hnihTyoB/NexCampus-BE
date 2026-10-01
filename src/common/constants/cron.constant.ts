export const CRON_QUEUE_NAME = "cron-scheduler-queue";

export const CRON_JOB_NAMES = {
  CLEANUP_AUDIT_LOGS: "cleanup-audit-logs",
  CLEANUP_UNCONFIRMED_UPLOADS: "cleanup-unconfirmed-uploads",
  CLEANUP_EXPIRED_TOKENS: "cleanup-expired-tokens",
  DAILY_SUMMARY_DIGEST: "daily-summary-digest",
  WEEKLY_SUMMARY_DIGEST: "weekly-summary-digest",
  REMIND_DAILY_REPORT: "remind-daily-report",
  REMIND_DAILY_REPORT_FIRST: "remind-daily-report-first",
  REMIND_DAILY_REPORT_CLOSING: "remind-daily-report-closing",
  DAILY_STANDUP_EXECUTIVE_SUMMARY: "daily-standup-executive-summary",
  REMIND_UPCOMING_MEETINGS: "remind-upcoming-meetings",
  WEEKLY_LEADERBOARD_DISCORD: "weekly-leaderboard-discord",
} as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES];

export const DEFAULT_CRON_SCHEDULES: Record<
  CronJobName,
  { cron: string; description: string }
> = {
  "cleanup-audit-logs": {
    cron: "0 2 * * *", // Daily at 02:00 AM Asia/Ho_Chi_Minh (UTC+7)
    description: "Dọn dẹp các bản ghi Audit Logs cũ hơn 30 ngày",
  },
  "cleanup-unconfirmed-uploads": {
    cron: "0 3 * * *", // Daily at 03:00 AM Asia/Ho_Chi_Minh (UTC+7)
    description:
      "Quét và xóa các file upload rác/không xác nhận trên Cloudflare R2 / S3",
  },
  "cleanup-expired-tokens": {
    cron: "0 4 * * *", // Daily at 04:00 AM Asia/Ho_Chi_Minh (UTC+7)
    description:
      "Dọn dẹp các Refresh Tokens, Verification Tokens và Password Reset Tokens đã hết hạn",
  },
  "daily-summary-digest": {
    cron: "0 8 * * *", // Daily at 08:00 AM Asia/Ho_Chi_Minh (UTC+7)
    description:
      "Tổng hợp số liệu hoạt động trong ngày và gửi email báo cáo tới Quản trị viên",
  },
  "weekly-summary-digest": {
    cron: "0 8 * * 1", // Mondays at 08:00 AM Asia/Ho_Chi_Minh (UTC+7)
    description:
      "Tổng hợp số liệu hoạt động trong tuần và gửi email báo cáo tới Quản trị viên",
  },
  "remind-daily-report": {
    cron: "0 17 * * 1-5", // Thứ 2 đến Thứ 6 lúc 17:00 Asia/Ho_Chi_Minh
    description:
      "Nhắc nhở nộp báo cáo ngày cho thực tập sinh (Tự động miễn trừ người có phép đã duyệt)",
  },
  "remind-daily-report-first": {
    cron: "30 17 * * 1-5", // Thứ 2 đến Thứ 6 lúc 17:30 Asia/Ho_Chi_Minh
    description:
      "Nhắc nhở nộp báo cáo ngày đợt 1 (17:30) qua Discord Webhook theo Phòng ban và In-app",
  },
  "remind-daily-report-closing": {
    cron: "30 18 * * 1-5", // Thứ 2 đến Thứ 6 lúc 18:30 Asia/Ho_Chi_Minh
    description:
      "Điểm danh chốt ca nộp báo cáo ngày (18:30) qua Discord Webhook (tag đích danh)",
  },
  "daily-standup-executive-summary": {
    cron: "45 18 * * 1-5", // 18:45 từ Thứ 2 đến Thứ 6 Asia/Ho_Chi_Minh
    description:
      "Báo cáo tóm tắt thông minh điều hành Standup ngày (Smart Standup Executive Summary) cho Leader",
  },
  "remind-upcoming-meetings": {
    cron: "*/5 * * * *", // Quét mỗi 5 phút
    description:
      "Quét và nhắc nhở cuộc họp trước 15 phút qua Discord Webhook phòng họp",
  },
  "weekly-leaderboard-discord": {
    cron: "0 9 * * 1", // Thứ 2 lúc 09:00 sáng Asia/Ho_Chi_Minh
    description:
      "Bảng vàng vinh danh Top 3 thực tập sinh xuất sắc nhất tuần trên kênh Discord #vinh-danh",
  },
};

export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 30;
export const DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS = 24;
