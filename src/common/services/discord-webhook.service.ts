import { discordWebhookRepository } from "../../modules/integration/discord-webhook.repository";
import { envConfig } from "../../config/env.config";
import {
  DISCORD_EMBED_COLORS,
  DISCORD_PING_STATUS,
  DISCORD_WEBHOOK_PURPOSE,
  DISCORD_WEBHOOK_SCOPE,
  DISCORD_WEBHOOK_URL_REGEX,
  DEFAULT_DISCORD_BOT_USERNAME,
  DEFAULT_DISCORD_BOT_AVATAR,
  DiscordWebhookPurpose,
} from "../constants/discord.constant";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string; // ISO8601
  color?: number; // 24-bit integer
  footer?: DiscordEmbedFooter;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

export interface DiscordButtonComponent {
  type: 2;
  style: 5; // LINK BUTTON
  label: string;
  url: string;
  emoji?: { name: string };
}

export interface DiscordActionRowComponent {
  type: 1;
  components: DiscordButtonComponent[];
}

export interface SendDiscordPayload {
  webhookUrl: string;
  threadId?: string | null;
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRowComponent[];
}

export interface SendDiscordResult {
  success: boolean;
  statusCode?: number;
  message?: string;
}

export class DiscordWebhookService {
  /**
   * Che giấu token nhạy cảm trong Webhook URL khi trả về client.
   * Ví dụ: https://discord.com/api/webhooks/1554420470697426984/Vz1Qsi-rmoKA1rZL...
   * Trả về: https://discord.com/api/webhooks/1554420470697426984/Vz1Q...S2bR
   */
  maskWebhookUrl(url: string): string {
    if (!url) return "";
    const match = url.match(
      /^(https:\/\/(?:ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/)([A-Za-z0-9_-]+)$/,
    );
    if (match) {
      const base = match[1];
      const token = match[2];
      const prefix = token.slice(0, 4);
      const suffix = token.slice(-4);
      return `${base}${prefix}••••••••${suffix}`;
    }
    if (url.length <= 16) return "••••••••";
    return `${url.slice(0, 8)}••••••••${url.slice(-4)}`;
  }

  /**
   * Validate cú pháp URL Discord Webhook
   */
  isValidWebhookUrl(url: string): boolean {
    return Boolean(url && DISCORD_WEBHOOK_URL_REGEX.test(url.trim()));
  }

  /**
   * Gửi HTTP POST request chứa Embeds tới Discord Webhook (tự động gắn ?thread_id nếu có)
   * và fallback sang Discord Bot API gửi vào Thread nếu Webhook lỗi hoặc dùng placeholder
   */
  async sendEmbed(payload: SendDiscordPayload): Promise<SendDiscordResult> {
    const { webhookUrl, threadId, content, embeds, components, username, avatar_url } = payload;

    if (!webhookUrl && !threadId) {
      return { success: false, message: "Webhook URL hoặc Thread ID là bắt buộc" };
    }

    const body: Record<string, any> = {
      username: username || DEFAULT_DISCORD_BOT_USERNAME,
      avatar_url: avatar_url || DEFAULT_DISCORD_BOT_AVATAR,
      content: content || undefined,
      embeds: embeds && embeds.length > 0 ? embeds : undefined,
      components: components && components.length > 0 ? components : undefined,
    };

    // 1. Gửi qua Discord Webhook URL (kèm ?thread_id nếu có threadId)
    const cleanUrl = webhookUrl ? webhookUrl.trim() : "";
    if (cleanUrl && this.isValidWebhookUrl(cleanUrl)) {
      let targetUrl = cleanUrl;
      if (threadId) {
        try {
          const urlObj = new URL(targetUrl);
          urlObj.searchParams.set("thread_id", threadId);
          targetUrl = urlObj.toString();
        } catch {
          // ignore URL parse error
        }
      }

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "NexCampus-Webhook-Dispatcher/2.0",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000), // Timeout 6s
        });

        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            message: "Tin nhắn đã được gửi tới Discord thành công",
          };
        }

        console.warn(
          `[DiscordWebhookService] Webhook URL returned HTTP ${response.status}, attempting Bot API fallback...`,
        );
      } catch (err: any) {
        console.warn(
          `[DiscordWebhookService] Webhook dispatch failed: ${err?.message}, checking Bot API fallback...`,
        );
      }
    }

    // 2. Fallback: Nếu có threadId và Bot Token, gọi trực tiếp Discord Bot Channel Message API
    const botToken =
      envConfig.discord?.botToken || process.env.DISCORD_BOT_TOKEN;
    if (threadId && botToken) {
      try {
        const botRes = await fetch(
          `https://discord.com/api/v10/channels/${threadId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
              "User-Agent": "NexCampus-Bot-Dispatcher/2.0",
            },
            body: JSON.stringify({
              content: content || undefined,
              embeds: embeds && embeds.length > 0 ? embeds : undefined,
              components: components && components.length > 0 ? components : undefined,
            }),
            signal: AbortSignal.timeout(6000),
          },
        );

        if (botRes.ok) {
          return {
            success: true,
            statusCode: botRes.status,
            message: "Tin nhắn đã được gửi thẳng vào Luồng riêng tư (Private Thread) qua Bot API",
          };
        }

        const errText = await botRes.text().catch(() => "");
        return {
          success: false,
          statusCode: botRes.status,
          message: `Discord Bot API trả về lỗi ${botRes.status}: ${errText}`,
        };
      } catch (botErr: any) {
        return {
          success: false,
          message: `Bot API fallback failed: ${botErr?.message}`,
        };
      }
    }

    return {
      success: false,
      message: "Không thể gửi tin nhắn tới Discord (Webhook không hợp lệ hoặc Thread ID chưa được chỉ định)",
    };
  }

  /**
   * Gửi tin nhắn Test Ping kiểm tra Webhook URL và cập nhật trạng thái trong database nếu có ID
   */
  async testPingWebhook(configIdOrUrl: {
    id?: string;
    webhookUrl?: string;
    discordRoleId?: string | null;
    threadId?: string | null;
    channelName?: string;
  }): Promise<{
    success: boolean;
    message: string;
    statusCode?: number;
    lastPingAt: Date;
  }> {
    let targetUrl = configIdOrUrl.webhookUrl;
    let targetRoleId = configIdOrUrl.discordRoleId;
    let targetThreadId = configIdOrUrl.threadId;
    let configRecord: any = null;

    if (configIdOrUrl.id) {
      configRecord = await discordWebhookRepository.findById(configIdOrUrl.id);

      if (!configRecord) {
        throw new AppError(
          "Cấu hình Discord Webhook không tồn tại",
          404,
          ERROR_CODE.DISCORD_WEBHOOK_NOT_FOUND,
        );
      }
      targetUrl = configRecord.webhookUrl;
      targetRoleId = configRecord.discordRoleId;
      targetThreadId = configRecord.threadId;
    }

    if (!targetUrl) {
      throw new AppError(
        "Thiếu Webhook URL để kiểm thử",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const now = new Date();
    const roleTag = targetRoleId ? `<@&${targetRoleId}> ` : "";
    const scopeLabel = configRecord?.taskGroup?.name
      ? `Nhóm: ${configRecord.taskGroup.name}`
      : configRecord?.department?.name
        ? `Phòng ban: ${configRecord.department.name}`
        : "Toàn trường (Global)";

    const purposeLabel = configRecord?.purpose
      ? configRecord.purpose
      : configIdOrUrl.channelName || "Kênh kết nối tự động";

    const testEmbed: DiscordEmbed = {
      title: "🚀 NexCampus Discord Automation Connected!",
      description: `Kết nối Webhook thành công với hệ sinh thái quản lý thực tập sinh **NexCampus**.\nKênh này đã sẵn sàng tiếp nhận thông báo tự động.`,
      color: DISCORD_EMBED_COLORS.TEST_PING,
      fields: [
        { name: "Phạm vi phân luồng", value: `\`${scopeLabel}\``, inline: true },
        { name: "Mục đích kênh", value: `\`${purposeLabel}\``, inline: true },
        {
          name: "Role được tag",
          value: targetRoleId ? `<@&${targetRoleId}> (\`${targetRoleId}\`)` : "*Không có*",
          inline: true,
        },
        {
          name: "Trạng thái",
          value: "🟢 Hoạt động ổn định (Active & Healthy)",
          inline: false,
        },
      ],
      footer: {
        text: "NexCampus Automation Dispatcher • Test Ping Cyberpunk Edition",
      },
      timestamp: now.toISOString(),
    };

    const result = await this.sendEmbed({
      webhookUrl: targetUrl,
      threadId: targetThreadId || undefined,
      content: roleTag ? `${roleTag}🔔 **Test Ping thử nghiệm kết nối!**` : undefined,
      embeds: [testEmbed],
    });

    // Cập nhật trạng thái bản ghi trong DB nếu có ID
    if (configRecord) {
      await discordWebhookRepository.updatePingStatus(configRecord.id, {
        lastPingAt: now,
        lastStatus: result.success
          ? DISCORD_PING_STATUS.SUCCESS
          : DISCORD_PING_STATUS.FAILED,
        lastError: result.success ? null : result.message || "Failed to ping",
      });
    }

    return {
      success: result.success,
      message: result.message || (result.success ? "Test ping thành công" : "Test ping thất bại"),
      statusCode: result.statusCode,
      lastPingAt: now,
    };
  }

  /**
   * Tìm kiếm Webhook URL theo nguyên tắc Phân luồng & Cách ly kênh (Channel Isolation):
   * Priority: TaskGroup -> Department -> Global (cho LEADERBOARD / LEADER_ALERTS).
   */
  async findWebhookForRouting(params: {
    purpose: DiscordWebhookPurpose;
    departmentId?: string | null;
    taskGroupId?: string | null;
  }) {
    return discordWebhookRepository.findWebhookForRouting(params);
  }

  // ─── 4 LUỒNG THÔNG BÁO DISCORD CHUẨN HOÁ ──────────────────────────────────────

  /**
   * 1.1 Kênh #daily-standup: Nhắc nhở đợt 1 (17:30)
   * Embed màu Vàng/Cam (#FEE75C), tag role Discord của nhóm, kèm link /intern/daily-report
   */
  async notifyDailyStandupReminder(params: {
    departmentId: string;
    departmentName: string;
    roleId?: string | null;
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP,
      departmentId: params.departmentId,
    });

    if (!webhook) {
      console.log(
        `[DiscordWebhookService] No DAILY_STANDUP webhook configured for department: ${params.departmentName}`,
      );
      return false;
    }

    const roleTag = webhook.discordRoleId
      ? `<@&${webhook.discordRoleId}>`
      : params.roleId
        ? `<@&${params.roleId}>`
        : "";

    const embed: DiscordEmbed = {
      title: `⏰ Nhắc nhở Báo cáo ngày — ${params.departmentName}`,
      description: `Đã đến **17:30** rồi! Các bạn thực tập sinh thuộc **${params.departmentName}** hãy dành 5 phút để hoàn thành báo cáo tiến độ ca làm việc hôm nay nhé.`,
      color: DISCORD_EMBED_COLORS.STANDUP_REMINDER,
      fields: [
        {
          name: "🔗 Đường dẫn nộp báo cáo",
          value: `[👉 Nhấn vào đây để nộp Daily Report](${envConfig.clientUrl}/intern/daily-report)`,
          inline: false,
        },
        {
          name: "⏳ Hạn chót ca hôm nay",
          value: "`18:30` (Sau 18:30 hệ thống sẽ điểm danh tự động)",
          inline: true,
        },
        {
          name: "🛡️ Miễn trừ tự động",
          value: "Intern đã nộp report hoặc có đơn nghỉ phép đã duyệt được miễn chuông.",
          inline: true,
        },
      ],
      footer: { text: "NexCampus Standup Engine • Nhắc nhở đợt 1" },
      timestamp: new Date().toISOString(),
    };

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: roleTag ? `${roleTag} 📢 **Nhắc nhở nộp báo cáo tiến độ ngày!**` : undefined,
      embeds: [embed],
    });

    return res.success;
  }

  /**
   * 1.2 Kênh #daily-standup: Điểm danh chốt ca (18:30)
   * Embed màu Đỏ Cam danh sách những ai chưa nộp, tag đích danh <@discordUserId> hoặc họ tên
   */
  async notifyDailyStandupClosing(params: {
    departmentId: string;
    departmentName: string;
    missingInterns: Array<{
      fullName: string;
      discordUsername?: string | null;
      internCode?: string | null;
    }>;
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP,
      departmentId: params.departmentId,
    });

    if (!webhook) return false;

    // Nếu tất cả đã nộp đủ 100%
    if (params.missingInterns.length === 0) {
      const celebrateEmbed: DiscordEmbed = {
        title: `🎉 100% Hoàn thành Báo cáo ngày — ${params.departmentName}`,
        description: `Tuyệt vời! Toàn bộ thực tập sinh thuộc **${params.departmentName}** đã hoàn thành nộp báo cáo ca hôm nay đúng hạn. Chúc các bạn buổi tối vui vẻ!`,
        color: DISCORD_EMBED_COLORS.STANDUP_SUCCESS,
        footer: { text: "NexCampus Standup Engine • Chốt ca 18:30" },
        timestamp: new Date().toISOString(),
      };
      await this.sendEmbed({
        webhookUrl: webhook.webhookUrl,
        threadId: (webhook as any).threadId || undefined,
        embeds: [celebrateEmbed],
      });
      return true;
    }

    // Danh sách tag hoặc hiển thị tên
    const mentions = params.missingInterns
      .map((intern, index) => {
        const username = intern.discordUsername?.trim();
        // Nếu là Discord Snowflake ID (17-20 chữ số) hoặc username
        const tag = username
          ? /^\d{17,20}$/.test(username)
            ? `<@${username}>`
            : `@${username}`
          : `**${intern.fullName}**`;
        const code = intern.internCode ? ` (\`${intern.internCode}\`)` : "";
        return `${index + 1}. ${tag}${code} — *Chưa nộp*`;
      })
      .join("\n");

    const embed: DiscordEmbed = {
      title: `🚨 Điểm danh Chốt ca Báo cáo ngày — ${params.departmentName}`,
      description: `Đã đến **18:30**! Hệ thống điểm danh chốt ca ghi nhận danh sách thực tập sinh **chưa nộp báo cáo ngày** hôm nay:`,
      color: DISCORD_EMBED_COLORS.STANDUP_CLOSING,
      fields: [
        {
          name: `⚠️ Danh sách chưa nộp (${params.missingInterns.length} bạn)`,
          value: mentions.length > 1024 ? mentions.slice(0, 1020) + "..." : mentions,
          inline: false,
        },
        {
          name: "🔗 Nộp bù khẩn cấp",
          value: `[👉 Nhấn vào đây để nộp ngay](${envConfig.clientUrl}/intern/daily-report)`,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Standup Engine • Điểm danh chốt ca 18:30" },
      timestamp: new Date().toISOString(),
    };

    const directTags = params.missingInterns
      .map((i) => (i.discordUsername && /^\d{17,20}$/.test(i.discordUsername) ? `<@${i.discordUsername}>` : ""))
      .filter(Boolean)
      .join(" ");

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: directTags ? `${directTags} ⚠️ Vui lòng nộp báo cáo ngày ngay!` : undefined,
      embeds: [embed],
    });

    return res.success;
  }

  /**
   * 2.1 Kênh #task-board: Task mới được giao
   * Embed Xanh Dương (#5865F2) gồm Tên Task, Deadline, Người phụ trách, Link task
   */
  async notifyTaskCreated(params: {
    departmentId?: string | null;
    taskGroupId?: string | null;
    task: {
      id: string;
      code?: string | null;
      title: string;
      deadline: Date | string;
      priority?: string;
      assigneeName?: string | null;
      assigneeDiscordId?: string | null;
      assignerName?: string | null;
    };
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
      departmentId: params.departmentId,
      taskGroupId: params.taskGroupId,
    });

    if (!webhook) return false;

    const deadlineStr = new Date(params.task.deadline).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const assigneeTag = params.task.assigneeDiscordId
      ? `<@${params.task.assigneeDiscordId}>`
      : params.task.assigneeName || "Chưa phân công";

    const embed: DiscordEmbed = {
      title: `📌 Nhiệm vụ mới: [${params.task.code || "TASK"}] ${params.task.title}`,
      description: `Một nhiệm vụ mới đã được khởi tạo và giao việc thành công trên hệ thống.`,
      color: DISCORD_EMBED_COLORS.TASK_CREATED,
      fields: [
        { name: "👤 Người phụ trách", value: assigneeTag, inline: true },
        { name: "⏰ Hạn chót (Deadline)", value: `\`${deadlineStr}\``, inline: true },
        { name: "⚡ Độ ưu tiên", value: `\`${params.task.priority || "MEDIUM"}\``, inline: true },
        {
          name: "🔗 Chi tiết nhiệm vụ",
          value: `[👉 Xem nhiệm vụ trên NexCampus](${envConfig.clientUrl}/intern/task)`,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Task Board • Real-time Event" },
      timestamp: new Date().toISOString(),
    };

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      embeds: [embed],
    });

    return res.success;
  }

  /**
   * 2.2 Kênh #task-board: Bài nộp mới (Needs Review)
   * Tag Leader phụ trách kèm link preview bài nộp
   */
  async notifyTaskNeedsReview(params: {
    departmentId?: string | null;
    taskGroupId?: string | null;
    task: {
      code?: string | null;
      title: string;
      internName: string;
      internDiscordId?: string | null;
      attempt: number;
      prLink?: string | null;
      videoDemo?: string | null;
      leaderDiscordId?: string | null;
      leaderName?: string | null;
    };
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
      departmentId: params.departmentId,
      taskGroupId: params.taskGroupId,
    });

    if (!webhook) return false;

    const leaderTag = params.task.leaderDiscordId
      ? `<@${params.task.leaderDiscordId}>`
      : params.task.leaderName
        ? `@${params.task.leaderName}`
        : "";

    const embed: DiscordEmbed = {
      title: `📝 Bài nộp mới (Cần duyệt): [${params.task.code || "TASK"}] ${params.task.title}`,
      description: `Thực tập sinh **${params.task.internName}** vừa nộp kết quả công việc (Lần ${params.task.attempt}).`,
      color: DISCORD_EMBED_COLORS.TASK_REVIEW,
      fields: [
        { name: "👨‍💻 Người nộp", value: params.task.internName, inline: true },
        { name: "🔄 Lần nộp", value: `Lần ${params.task.attempt}`, inline: true },
        {
          name: "🔗 Pull Request / Code",
          value: params.task.prLink ? `[Github PR](${params.task.prLink})` : "*Không có PR link*",
          inline: true,
        },
        {
          name: "🎥 Video Demo",
          value: params.task.videoDemo ? `[Xem Demo](${params.task.videoDemo})` : "*Không có video*",
          inline: true,
        },
        {
          name: "🔍 Thao tác đánh giá",
          value: `[👉 Nhấn vào đây để duyệt bài nộp](${envConfig.clientUrl}/leader/tasks)`,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Task Board • Review Submission" },
      timestamp: new Date().toISOString(),
    };

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: leaderTag ? `${leaderTag} 🔔 Bạn có bài nộp mới cần xét duyệt!` : undefined,
      embeds: [embed],
    });

    return res.success;
  }

  /**
   * 2.3 Kênh #task-board: Task bị cản trở (Blocked)
   * Embed Đỏ Neon (#ED4245), in đậm blockedReason và tag ngay Leader để xử lý kịp thời
   */
  async notifyTaskBlocked(params: {
    departmentId?: string | null;
    taskGroupId?: string | null;
    task: {
      id?: string;
      code?: string | null;
      title: string;
      internName: string;
      blockedReason: string;
      leaderDiscordId?: string | null;
      leaderName?: string | null;
    };
  }): Promise<boolean> {
    let webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
      departmentId: params.departmentId,
      taskGroupId: params.taskGroupId,
    });

    if (!webhook) {
      webhook = await this.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
        departmentId: params.departmentId,
      });
    }

    if (!webhook) return false;

    const leaderTag = params.task.leaderDiscordId
      ? `<@${params.task.leaderDiscordId}>`
      : params.task.leaderName
        ? `@${params.task.leaderName}`
        : "";

    const appUrl = envConfig.clientUrl || envConfig.appUrl;
    const taskLinkUrl = params.task.id
      ? `${appUrl}/leader/tasks?taskId=${params.task.id}`
      : `${appUrl}/leader/tasks?status=BLOCKED`;

    const embed: DiscordEmbed = {
      title: `🛑 CẢNH BÁO BỊ CHẶN (BLOCKED): [${params.task.code || "TASK"}] ${params.task.title}`,
      description: `Thực tập sinh **${params.task.internName}** đã báo cáo nhiệm vụ bị tắc nghẽn và không thể tiếp tục hoàn thành nếu không có sự hỗ trợ.`,
      color: DISCORD_EMBED_COLORS.TASK_BLOCKED,
      fields: [
        {
          name: "⚠️ Lý do bị cản trở (Blocked Reason)",
          value: `>>> **${params.task.blockedReason}**`,
          inline: false,
        },
        { name: "👤 Người phụ trách", value: params.task.internName, inline: true },
        {
          name: "🎯 Người phụ trách giải quyết",
          value: leaderTag || params.task.leaderName || "Leader phụ trách",
          inline: true,
        },
        {
          name: "🔗 Mở khóa nhiệm vụ",
          value: `[👉 Vào bảng Task để gỡ vướng mắc](${taskLinkUrl})`,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Leader Alerts • Khẩn cấp" },
      timestamp: new Date().toISOString(),
    };

    const components: DiscordActionRowComponent[] = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "🚀 Vào Hỗ Trợ Task Ngay",
            url: taskLinkUrl,
          },
        ],
      },
    ];

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: leaderTag ? `${leaderTag} 🚨 **Có nhiệm vụ bị nghẽn cần tháo gỡ ngay!**` : undefined,
      embeds: [embed],
      components,
    });

    return res.success;
  }

  /**
   * 2.4 Kênh #task-board / Leader: Yêu cầu xin gia hạn task mới (Task Extension Request)
   * Embed Vàng/Cam cảnh báo kèm Link Button dẫn thẳng vào duyệt đơn gia hạn
   */
  async notifyTaskExtensionRequested(params: {
    departmentId?: string | null;
    taskGroupId?: string | null;
    requestId: string;
    task: {
      id: string;
      code?: string | null;
      title: string;
      internName: string;
      extensionDays: number;
      proposedDeadline: Date | string;
      reason: string;
      commitmentPlan?: string | null;
      leaderDiscordId?: string | null;
      leaderName?: string | null;
    };
  }): Promise<boolean> {
    let webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
      departmentId: params.departmentId,
      taskGroupId: params.taskGroupId,
    });

    if (!webhook) {
      webhook = await this.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
        departmentId: params.departmentId,
      });
    }

    if (!webhook) return false;

    const leaderTag = params.task.leaderDiscordId
      ? `<@${params.task.leaderDiscordId}>`
      : params.task.leaderName
        ? `@${params.task.leaderName}`
        : "";

    const appUrl = envConfig.clientUrl || envConfig.appUrl;
    const extensionUrl = `${appUrl}/leader/tasks?tab=extensions&requestId=${params.requestId}`;

    const deadlineStr = new Date(params.task.proposedDeadline).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const embed: DiscordEmbed = {
      title: `⏳ ĐỀ XUẤT XIN GIA HẠN: [${params.task.code || "TASK"}] ${params.task.title}`,
      description: `Thực tập sinh **${params.task.internName}** vừa gửi đề xuất xin gia hạn hạn chót cho nhiệm vụ này.`,
      color: DISCORD_EMBED_COLORS.STANDUP_REMINDER, // Màu Vàng/Cam (#FEE75C)
      fields: [
        { name: "👤 Người xin gia hạn", value: params.task.internName, inline: true },
        { name: "⏱️ Thời gian xin thêm", value: `\`+${params.task.extensionDays} ngày\``, inline: true },
        { name: "📅 Hạn chót mới đề xuất", value: `\`${deadlineStr}\``, inline: true },
        {
          name: "📝 Lý do xin gia hạn",
          value: `>>> **${params.task.reason}**`,
          inline: false,
        },
        ...(params.task.commitmentPlan
          ? [
              {
                name: "🎯 Kế hoạch cam kết hoàn thành",
                value: params.task.commitmentPlan,
                inline: false,
              },
            ]
          : []),
        {
          name: "🔗 Xem xét phê duyệt",
          value: `[👉 Nhấn vào đây để xem và duyệt gia hạn](${extensionUrl})`,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Task Board • Yêu cầu xin gia hạn" },
      timestamp: new Date().toISOString(),
    };

    const components: DiscordActionRowComponent[] = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "⏳ Xem & Duyệt Gia Hạn",
            url: extensionUrl,
          },
        ],
      },
    ];

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: leaderTag ? `${leaderTag} 🔔 Có đề xuất xin gia hạn nhiệm vụ cần xét duyệt!` : undefined,
      embeds: [embed],
      components,
    });

    return res.success;
  }

  /**
   * 1.3 Kênh #leader-hq-alerts / Leader: Báo cáo tóm tắt thông minh điều hành Standup ngày (18:45)
   * Embed Cyberpunk Blurple (#5865F2)
   * Gắn kèm 2 nút Action Row:
   * [ 🛠️ Gỡ Rối Task Block ] ➔ ${appUrl}/leader/tasks?status=BLOCKED
   * [ ⏳ Duyệt Đơn Gia Hạn ] ➔ ${appUrl}/leader/tasks?tab=extensions
   */
  async notifyDailyStandupExecutiveSummary(params: {
    targetWebhookUrl?: string;
    targetThreadId?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
    summaryDateStr: string;
    totalActiveInterns: number;
    submittedCount: number;
    approvedAbsences: Array<{
      internName: string;
      internCode?: string | null;
      departmentName?: string | null;
      reason: string;
    }>;
    blockedTasks: Array<{
      taskId: string;
      taskCode?: string | null;
      taskTitle: string;
      internName: string;
      blockedReason: string;
    }>;
    pendingExtensions: Array<{
      requestId: string;
      taskId: string;
      taskCode?: string | null;
      taskTitle: string;
      internName: string;
      extensionDays: number;
    }>;
  }): Promise<boolean> {
    let targetUrl = params.targetWebhookUrl;
    let targetThreadId = params.targetThreadId;

    if (!targetUrl) {
      // Tìm Webhook cho LEADER_ALERTS (Global hoặc theo Phòng ban)
      const webhook = await this.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
        departmentId: params.departmentId,
      });
      if (webhook) {
        targetUrl = webhook.webhookUrl;
        targetThreadId = (webhook as any).threadId || null;
      }
    }

    if (!targetUrl) {
      console.warn(
        `[DiscordWebhookService] No Webhook found for Daily Standup Executive Summary (LEADER_ALERTS)`,
      );
      return false;
    }

    const appUrl = envConfig.clientUrl || envConfig.appUrl;
    const completionRate =
      params.totalActiveInterns > 0
        ? Math.round((params.submittedCount / params.totalActiveInterns) * 100)
        : 100;

    const scopeTitle = params.departmentName
      ? `BAN ${params.departmentName.toUpperCase()}`
      : "TOÀN TRƯỜNG (HQ)";

    // Format danh sách vắng phép
    let absenceText = "*Không có bạn nào nghỉ phép hôm nay*";
    if (params.approvedAbsences.length > 0) {
      absenceText = params.approvedAbsences
        .map((a, i) => {
          const dept = a.departmentName ? ` [${a.departmentName}]` : "";
          const code = a.internCode ? ` (\`${a.internCode}\`)` : "";
          return `${i + 1}. **${a.internName}**${code}${dept} — *Lý do*: ${a.reason}`;
        })
        .join("\n");
      if (absenceText.length > 1024) {
        absenceText = absenceText.slice(0, 1020) + "...";
      }
    }

    // Format danh sách task blocked
    let blockedText = "*Không có task nào bị nghẽn (Zero Blockers)* 🟢";
    if (params.blockedTasks.length > 0) {
      blockedText = params.blockedTasks
        .map((b, i) => {
          const code = b.taskCode ? `[${b.taskCode}] ` : "";
          return `${i + 1}. **${code}${b.taskTitle}** — Phụ trách: **${b.internName}**\n  ↳ 🛑 *Nghẽn do*: ${b.blockedReason}`;
        })
        .join("\n");
      if (blockedText.length > 1024) {
        blockedText = blockedText.slice(0, 1020) + "...";
      }
    }

    // Format danh sách gia hạn pending
    let extensionText = "*Không có đơn gia hạn chờ duyệt*";
    if (params.pendingExtensions.length > 0) {
      extensionText = params.pendingExtensions
        .map((e, i) => {
          const code = e.taskCode ? `[${e.taskCode}] ` : "";
          return `${i + 1}. **${code}${e.taskTitle}** — **${e.internName}** xin gia hạn \`+${e.extensionDays} ngày\``;
        })
        .join("\n");
      if (extensionText.length > 1024) {
        extensionText = extensionText.slice(0, 1020) + "...";
      }
    }

    const embed: DiscordEmbed = {
      title: `📊 SMART STANDUP EXECUTIVE SUMMARY — ${scopeTitle}`,
      description: `Báo cáo điều hành tổng kết tiến độ và các điểm nghẽn ngày **${params.summaryDateStr}** lúc 18:45 dành cho Ban Quản Trị & Leader.`,
      color: DISCORD_EMBED_COLORS.EXECUTIVE_SUMMARY,
      fields: [
        {
          name: "📈 Tiến độ nộp Daily Report",
          value: `• Hoàn thành: **${params.submittedCount}/${params.totalActiveInterns}** bạn (**${completionRate}%**)\n• Chưa nộp: **${params.totalActiveInterns - params.submittedCount}** bạn`,
          inline: true,
        },
        {
          name: "🏖️ Nghỉ phép có duyệt",
          value: `**${params.approvedAbsences.length}** bạn đã duyệt nghỉ hôm nay`,
          inline: true,
        },
        {
          name: "🚨 Điểm nghẽn & Tắc vụ",
          value: `• Task Blocked: **${params.blockedTasks.length}**\n• Chờ duyệt gia hạn: **${params.pendingExtensions.length}**`,
          inline: true,
        },
        {
          name: `🏖️ Danh sách nghỉ phép (${params.approvedAbsences.length} bạn)`,
          value: absenceText,
          inline: false,
        },
        {
          name: `🛑 Danh sách Task đang bị cản trở (${params.blockedTasks.length} task)`,
          value: blockedText,
          inline: false,
        },
        {
          name: `⏳ Danh sách xin gia hạn chờ duyệt (${params.pendingExtensions.length} đơn)`,
          value: extensionText,
          inline: false,
        },
      ],
      footer: {
        text: "NexCampus Automation Dispatcher • Executive Standup Summary 18:45",
      },
      timestamp: new Date().toISOString(),
    };

    const components: DiscordActionRowComponent[] = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "🛠️ Gỡ Rối Task Block",
            url: `${appUrl}/leader/tasks?status=BLOCKED`,
          },
          {
            type: 2,
            style: 5,
            label: "⏳ Duyệt Đơn Gia Hạn",
            url: `${appUrl}/leader/tasks?tab=extensions`,
          },
        ],
      },
    ];

    const res = await this.sendEmbed({
      webhookUrl: targetUrl,
      threadId: targetThreadId || undefined,
      content: "📢 **Bản tin điều hành Standup cuối ngày đã sẵn sàng!**",
      embeds: [embed],
      components,
    });

    return res.success;
  }

  /**
   * 3. Kênh #meeting-room: Nhắc nhở họp trước 15 phút
   * Quét lịch họp từ bảng meetings, bắn Embed nhắc nhở trước giờ bắt đầu 15 phút
   */
  async notifyMeetingReminder(params: {
    departmentId?: string | null;
    meeting: {
      id: string;
      title: string;
      departmentName?: string | null;
      startTime: Date | string;
      endTime?: Date | string;
      meetingLink?: string | null;
      location?: string | null;
      hostName?: string | null;
    };
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM,
      departmentId: params.departmentId,
    });

    if (!webhook) return false;

    const startStr = new Date(params.meeting.startTime).toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
    });

    const link = params.meeting.meetingLink || params.meeting.location || "Kênh Discord Voice";

    const embed: DiscordEmbed = {
      title: `⏰ Nhắc nhở: Cuộc họp sẽ bắt đầu sau 15 phút!`,
      description: `Cuộc họp **${params.meeting.title}** sắp diễn ra vào lúc **${startStr}**. Vui lòng kiểm tra micro, camera và chuẩn bị tham dự.`,
      color: DISCORD_EMBED_COLORS.MEETING_REMINDER,
      fields: [
        { name: "📋 Chủ đề cuộc họp", value: params.meeting.title, inline: false },
        { name: "🏢 Phòng ban", value: params.meeting.departmentName || "Nội bộ", inline: true },
        { name: "🕒 Giờ bắt đầu", value: `\`${startStr}\``, inline: true },
        { name: "🎙️ Người chủ trì", value: params.meeting.hostName || "Host", inline: true },
        {
          name: "🔗 Đường dẫn tham gia",
          value: link.startsWith("http") ? `[👉 Nhấn vào đây để vào họp](${link})` : `\`${link}\``,
          inline: false,
        },
      ],
      footer: { text: "NexCampus Meeting Room • Nhắc họp tự động" },
      timestamp: new Date().toISOString(),
    };

    const roleTag = webhook.discordRoleId ? `<@&${webhook.discordRoleId}> ` : "";

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      threadId: (webhook as any).threadId || undefined,
      content: roleTag ? `${roleTag}📢 **Sắp đến giờ họp!**` : undefined,
      embeds: [embed],
    });

    return res.success;
  }

  /**
   * 4. Kênh #vinh-danh: Toàn trường - Thứ Hai 09:00 hàng tuần
   * Embed Vàng Kim lấp lánh vinh danh Top 3 Thực tập sinh có điểm đánh giá tuần cao nhất
   */
  async notifyWeeklyLeaderboard(params: {
    week: number;
    year: number;
    topInterns: Array<{
      rank: number;
      fullName: string;
      internCode?: string | null;
      departmentName?: string | null;
      score: number;
      strengths?: string[];
      discordUsername?: string | null;
    }>;
  }): Promise<boolean> {
    const webhook = await this.findWebhookForRouting({
      purpose: DISCORD_WEBHOOK_PURPOSE.LEADERBOARD,
    });

    if (!webhook) {
      console.log("[DiscordWebhookService] No GLOBAL LEADERBOARD webhook configured");
      return false;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const topFields: DiscordEmbedField[] = params.topInterns.map((intern, i) => {
      const medal = medals[i] || "⭐";
      const dept = intern.departmentName ? ` | ${intern.departmentName}` : "";
      const strengthsText =
        intern.strengths && intern.strengths.length > 0
          ? `\n*Điểm nổi bật: ${intern.strengths.slice(0, 2).join(", ")}*`
          : "";
      return {
        name: `${medal} HẠNG ${intern.rank}: ${intern.fullName} — ${intern.score.toFixed(1)} Điểm`,
        value: `Mã TTS: \`${intern.internCode || "INT"}\`${dept}${strengthsText}`,
        inline: false,
      };
    });

    const embed: DiscordEmbed = {
      title: `✨ BẢNG VÀNG VINH DANH THỰC TẬP SINH XUẤT SẮC — TUẦN ${params.week}/${params.year} ✨`,
      description: `Hệ thống NexCampus trân trọng chúc mừng các bạn thực tập sinh đã có thành tích xuất sắc nhất trong kỳ đánh giá tuần qua! 🎉👏`,
      color: DISCORD_EMBED_COLORS.LEADERBOARD,
      fields:
        topFields.length > 0
          ? topFields
          : [
              {
                name: "Thông báo",
                value: "Chưa có đủ dữ liệu đánh giá tuần để xếp hạng.",
                inline: false,
              },
            ],
      footer: { text: "NexCampus Hall of Fame • Vinh Danh Toàn Trường" },
      timestamp: new Date().toISOString(),
    };

    const res = await this.sendEmbed({
      webhookUrl: webhook.webhookUrl,
      content: "🌟 **CHÚC MỪNG TOP THỰC TẬP SINH XUẤT SẮC NHẤT TUẦN!** 🌟",
      embeds: [embed],
    });

    return res.success;
  }
}

export const discordWebhookService = new DiscordWebhookService();
