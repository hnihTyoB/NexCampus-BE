export const DISCORD_WEBHOOK_SCOPE = {
  GLOBAL: "GLOBAL",
  DEPARTMENT: "DEPARTMENT",
  TASK_GROUP: "TASK_GROUP",
} as const;

export type DiscordWebhookScope =
  (typeof DISCORD_WEBHOOK_SCOPE)[keyof typeof DISCORD_WEBHOOK_SCOPE];

export const DISCORD_WEBHOOK_PURPOSE = {
  DAILY_STANDUP: "DAILY_STANDUP",
  TASK_BOARD: "TASK_BOARD",
  MEETING_ROOM: "MEETING_ROOM",
  LEADERBOARD: "LEADERBOARD",
  LEADER_ALERTS: "LEADER_ALERTS",
} as const;

export type DiscordWebhookPurpose =
  (typeof DISCORD_WEBHOOK_PURPOSE)[keyof typeof DISCORD_WEBHOOK_PURPOSE];

export const DISCORD_PING_STATUS = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type DiscordPingStatus =
  (typeof DISCORD_PING_STATUS)[keyof typeof DISCORD_PING_STATUS];

/**
 * Standard Cyberpunk & Discord Colors (in 24-bit Decimal Integer format for Discord API)
 */
export const DISCORD_EMBED_COLORS = {
  STANDUP_REMINDER: 0xfee75c, // Vàng/Cam nhắc nhở 17:30 (#FEE75C)
  STANDUP_CLOSING: 0xed4245, // Đỏ cam điểm danh chốt ca 18:30 (#ED4245)
  STANDUP_SUCCESS: 0x57f287, // Xanh lá hoàn tất 100% (#57F287)
  TASK_CREATED: 0x5865f2, // Blurple nhiệm vụ mới (#5865F2)
  TASK_REVIEW: 0x00d26a, // Xanh ngọc bài nộp cần duyệt (#00D26A)
  TASK_BLOCKED: 0xed4245, // Đỏ neon công việc bị tắc nghẽn (#ED4245)
  MEETING_REMINDER: 0x9b59b6, // Tím neon nhắc nhở phòng họp 15 phút (#9B59B6)
  LEADERBOARD: 0xf1c40f, // Vàng kim vinh danh Top tuần (#F1C40F)
  TEST_PING: 0x00f0ff, // Cyberpunk Cyan thử nghiệm kết nối (#00F0FF)
} as const;

/**
 * Regex chuẩn Discord Webhook URL (hỗ trợ cả ptb và canary)
 */
export const DISCORD_WEBHOOK_URL_REGEX =
  /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

export const DEFAULT_DISCORD_BOT_USERNAME = "NexCampus Bot";
export const DEFAULT_DISCORD_BOT_AVATAR =
  "https://cdn.discordapp.com/embed/avatars/0.png";

/**
 * Mảng màu Neon phong cách Cyberpunk để gán màu ngẫu nhiên cho Role phòng ban
 */
export const DISCORD_NEON_ROLE_COLORS = [
  0x00f0ff, // Cyberpunk Cyan
  0xa855f7, // Neon Purple
  0x10b981, // Emerald Green
  0xf43f5e, // Rose Neon
  0xf59e0b, // Amber Gold
  0x06b6d4, // Electric Blue
  0xec4899, // Fuchsia Neon
  0x3b82f6, // Bright Blue
] as const;

