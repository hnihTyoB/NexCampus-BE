import { envConfig } from "../../config/env.config";
import { prisma } from "../../database/prisma.client";
import {
  DISCORD_NEON_ROLE_COLORS,
  DISCORD_WEBHOOK_PURPOSE,
  DISCORD_WEBHOOK_SCOPE,
  DISCORD_CHANNEL_TYPE,
  DISCORD_VOICE_PERMISSIONS,
  DEFAULT_MEETING_EMPTY_BUFFER_MINUTES,
} from "../constants/discord.constant";
import { ROLES } from "../constants/role.constant";
import { AUDIT_ACTION } from "../constants/audit-log.constant";
import { discordWebhookRepository } from "../../modules/integration/discord-webhook.repository";

export interface DiscordVoiceChannelInfo {
  id: string;
  name: string;
  type: number;
  parentId?: string;
  position: number;
  userLimit?: number;
  bitrate?: number;
  currentMembersCount: number;
  voiceUrl: string;
  isPrivate?: boolean;
}

export interface BatchSyncRoleDetail {
  internId: string;
  internCode: string;
  fullName: string;
  email: string;
  departmentName: string;
  discordUserId: string | null;
  status: "GRANTED" | "REVOKED" | "ALREADY_SYNCED" | "MISSING_ID" | "FAILED";
  message: string;
}

export interface BatchSyncRolesResult {
  totalScanned: number;
  grantedCount: number;
  revokedCount: number;
  alreadySyncedCount: number;
  missingIdCount: number;
  failedCount: number;
  details: BatchSyncRoleDetail[];
}

export interface CreateRoleOptions {
  name: string;
  color?: number;
  mentionable?: boolean;
}

export interface CreatePrivateThreadOptions {
  channelId: string;
  name: string;
  autoArchiveDuration?: number;
  invitable?: boolean;
}

export interface DiscordBotStatus {
  isConnected: boolean;
  botId?: string;
  botName?: string;
  discriminator?: string;
  guildId?: string;
  guildName?: string;
  channelCount?: number;
  roleCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface ProvisionDepartmentResult {
  departmentId: string;
  departmentName: string;
  discordRoleId: string;
  roleName: string;
  threadId: string;
  threadName: string;
  parentChannelId: string;
  isNewlyCreated: boolean;
}

export class DiscordBotService {
  private readonly baseUrl = "https://discord.com/api/v10";
  private runtimeToken?: string;
  private runtimeGuildId?: string;
  private runtimeEnabled?: boolean;
  private activeProvisions = new Map<string, Promise<ProvisionDepartmentResult>>();

  // Real-time Voice State Tracking via Discord Gateway
  private voiceChannelMembers = new Map<string, Set<string>>(); // channelId -> Set<userId>
  private userToVoiceChannel = new Map<string, string>(); // userId -> channelId
  private channelEmptySince = new Map<string, number>(); // channelId -> timestamp (ms)
  private gatewayWs: any = null;
  private heartbeatTimer: any = null;
  private gatewayReconnectTimeout: any = null;
  private isGatewayConnecting = false;

  constructor() {
    if (typeof globalThis.WebSocket !== "undefined") {
      setTimeout(() => {
        if (this.token && this.isEnabled) {
          this.startGateway();
        }
      }, 3000);
    }
  }

  setRuntimeConfig(config: { token?: string; guildId?: string; enabled?: boolean }): void {
    if (config.token !== undefined) this.runtimeToken = config.token.trim();
    if (config.guildId !== undefined) this.runtimeGuildId = config.guildId.trim();
    if (config.enabled !== undefined) this.runtimeEnabled = config.enabled;

    if (this.token && this.isEnabled) {
      this.startGateway();
    } else {
      this.cleanupGateway();
    }
  }

  get isEnabled(): boolean {
    if (this.runtimeEnabled !== undefined) return this.runtimeEnabled;
    return envConfig.discord?.botEnabled ?? true;
  }

  private get token(): string {
    return (
      this.runtimeToken ??
      envConfig.discord?.botToken ??
      process.env.DISCORD_BOT_TOKEN ??
      ""
    ).trim();
  }

  private get guildId(): string {
    return (
      this.runtimeGuildId ??
      envConfig.discord?.guildId ??
      process.env.DISCORD_GUILD_ID ??
      ""
    ).trim();
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bot ${this.token}`,
      "Content-Type": "application/json",
      "User-Agent": "NexCampus-Bot-Orchestrator/2.0",
    };
  }

  /**
   * Kiểm tra trạng thái kết nối của Discord Bot tới Server (Guild)
   */
  async checkConnection(): Promise<DiscordBotStatus> {
    if (!this.token) {
      return {
        isConnected: false,
        error: "DISCORD_BOT_TOKEN chưa được cấu hình trong hệ thống.",
      };
    }

    const startTime = Date.now();

    try {
      // 1. Kiểm tra tài khoản Bot
      const meRes = await fetch(`${this.baseUrl}/users/@me`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (!meRes.ok) {
        const errorText = await meRes.text().catch(() => "");
        return {
          isConnected: false,
          error: `Xác thực Bot thất bại (${meRes.status}): ${errorText}`,
        };
      }

      const botUser = (await meRes.json()) as any;

      if (!this.guildId) {
        return {
          isConnected: true,
          botId: botUser.id,
          botName: botUser.username,
          discriminator: botUser.discriminator,
          latencyMs: Date.now() - startTime,
          error: "DISCORD_GUILD_ID chưa được chỉ định.",
        };
      }

      // 2. Kiểm tra quyền truy cập Guild
      const guildRes = await fetch(`${this.baseUrl}/guilds/${this.guildId}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (!guildRes.ok) {
        const errorText = await guildRes.text().catch(() => "");
        return {
          isConnected: false,
          botId: botUser.id,
          botName: botUser.username,
          discriminator: botUser.discriminator,
          error: `Bot không có quyền truy cập Server ID ${this.guildId} (${guildRes.status}): ${errorText}`,
        };
      }

      const guild = (await guildRes.json()) as any;

      return {
        isConnected: true,
        botId: botUser.id,
        botName: botUser.username,
        discriminator: botUser.discriminator,
        guildId: guild.id,
        guildName: guild.name,
        roleCount: Array.isArray(guild.roles) ? guild.roles.length : 0,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        error: err?.message || "Không thể kết nối tới Discord API Gateway.",
      };
    }
  }

  /**
   * Lấy danh sách channels trên Server Discord
   */
  async getGuildChannels(): Promise<
    Array<{ id: string; name: string; type: number; parentId?: string }>
  > {
    if (!this.token || !this.guildId) return [];

    try {
      const res = await fetch(
        `${this.baseUrl}/guilds/${this.guildId}/channels`,
        {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        console.warn(`[DiscordBot] getGuildChannels error HTTP ${res.status}`);
        return [];
      }

      return (await res.json()) as any;
    } catch (err: any) {
      console.warn(`[DiscordBot] getGuildChannels failed:`, err.message);
      return [];
    }
  }

  /**
   * Khởi chạy kết nối Discord Gateway WebSocket để theo dõi voice states trong thời gian thực
   */
  startGateway(): void {
    if (typeof globalThis.WebSocket === "undefined") {
      return;
    }
    if (!this.token || !this.isEnabled) return;
    if (this.isGatewayConnecting || (this.gatewayWs && this.gatewayWs.readyState === 1)) return;

    this.isGatewayConnecting = true;
    try {
      const ws = new (globalThis as any).WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
      this.gatewayWs = ws;

      ws.onopen = () => {
        this.isGatewayConnecting = false;
      };

      ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data?.toString();
          const payload = JSON.parse(raw);
          const { op, d, t } = payload;

          if (op === 10) {
            // Hello: Thiết lập Heartbeat và gửi Identify
            const heartbeatInterval = d?.heartbeat_interval || 41250;
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = setInterval(() => {
              if (this.gatewayWs && this.gatewayWs.readyState === 1) {
                this.gatewayWs.send(JSON.stringify({ op: 1, d: null }));
              }
            }, heartbeatInterval);

            // Gửi Identify với Intents: GUILDS (1) | GUILD_VOICE_STATES (128) = 129
            ws.send(
              JSON.stringify({
                op: 2,
                d: {
                  token: this.token,
                  intents: 129,
                  properties: {
                    os: "windows",
                    browser: "nexcampus",
                    device: "nexcampus",
                  },
                },
              }),
            );
          } else if (op === 0) {
            // Dispatch Events
            if (t === "VOICE_STATE_UPDATE" && d) {
              this.handleVoiceStateUpdate(d);
            }
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        this.cleanupGateway();
        this.scheduleGatewayReconnect();
      };

      ws.onerror = () => {
        this.cleanupGateway();
        this.scheduleGatewayReconnect();
      };
    } catch {
      this.cleanupGateway();
      this.scheduleGatewayReconnect();
    }
  }

  private cleanupGateway(): void {
    this.isGatewayConnecting = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.gatewayWs = null;
  }

  private scheduleGatewayReconnect(): void {
    if (this.gatewayReconnectTimeout) clearTimeout(this.gatewayReconnectTimeout);
    this.gatewayReconnectTimeout = setTimeout(() => {
      if (this.token && this.isEnabled) {
        this.startGateway();
      }
    }, 15000);
  }

  private handleVoiceStateUpdate(data: any): void {
    const userId = data.user_id;
    const newChannelId = data.channel_id; // null nếu user rời kênh
    const oldChannelId = this.userToVoiceChannel.get(userId);

    // 1. Rời kênh cũ
    if (oldChannelId && oldChannelId !== newChannelId) {
      const oldMembers = this.voiceChannelMembers.get(oldChannelId);
      if (oldMembers) {
        oldMembers.delete(userId);
        if (oldMembers.size === 0) {
          this.channelEmptySince.set(oldChannelId, Date.now());
        }
      }
      this.userToVoiceChannel.delete(userId);
    }

    // 2. Vào kênh mới
    if (newChannelId) {
      this.userToVoiceChannel.set(userId, newChannelId);
      let newMembers = this.voiceChannelMembers.get(newChannelId);
      if (!newMembers) {
        newMembers = new Set<string>();
        this.voiceChannelMembers.set(newChannelId, newMembers);
      }
      newMembers.add(userId);
      this.channelEmptySince.delete(newChannelId); // Phòng có người -> xóa cờ empty
    }
  }

  /**
   * Lấy số lượng người dùng đang ở trong Kênh Voice
   */
  getVoiceChannelMemberCount(channelId: string): number {
    return this.voiceChannelMembers.get(channelId)?.size || 0;
  }

  /**
   * Tạo đường dẫn trực tiếp tới Voice Channel trên Discord
   */
  getChannelVoiceUrl(channelId: string): string {
    const gid = this.guildId;
    return gid
      ? `https://discord.com/channels/${gid}/${channelId}`
      : `https://discord.com/channels/@me/${channelId}`;
  }

  /**
   * Lấy danh sách tất cả các Voice Channels trên Server Discord
   */
  async getGuildVoiceChannels(): Promise<DiscordVoiceChannelInfo[]> {
    if (!this.token || !this.guildId) return [];

    try {
      const channels = await this.getGuildChannels();
      const voiceTypes = [
        DISCORD_CHANNEL_TYPE.GUILD_VOICE,
        DISCORD_CHANNEL_TYPE.GUILD_STAGE_VOICE,
      ];

      const voiceChannels: DiscordVoiceChannelInfo[] = channels
        .filter((c: any) => voiceTypes.includes(c.type))
        .map((c: any) => {
          const everyoneOverwrite = (c as any).permission_overwrites?.find(
            (po: any) => po.id === this.guildId,
          );
          const denyBigInt = everyoneOverwrite ? BigInt(everyoneOverwrite.deny || "0") : BigInt(0);
          const isPrivate =
            (denyBigInt & BigInt(DISCORD_VOICE_PERMISSIONS.VIEW_CHANNEL)) !== BigInt(0) ||
            (denyBigInt & BigInt(DISCORD_VOICE_PERMISSIONS.CONNECT)) !== BigInt(0);

          return {
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parent_id || c.parentId,
            position: c.position || 0,
            userLimit: c.user_limit,
            bitrate: c.bitrate,
            currentMembersCount: this.getVoiceChannelMemberCount(c.id),
            voiceUrl: this.getChannelVoiceUrl(c.id),
            isPrivate,
          };
        });

      // Sắp xếp theo thứ tự hiển thị trên server Discord
      voiceChannels.sort((a, b) => a.position - b.position);
      return voiceChannels;
    } catch (err: any) {
      console.warn("[DiscordBot] getGuildVoiceChannels failed:", err?.message);
      return [];
    }
  }

  /**
   * Cấp quyền truy cập (Permission Overwrite) vào Voice Channel cho danh sách Discord User ID
   * 1. Khóa phòng đối với @everyone (Role ID = guildId): Deny VIEW_CHANNEL (1024) + CONNECT (1048576) -> Biến phòng thành Private
   * 2. Cấp quyền cho từng người tham gia: Allow VIEW_CHANNEL + CONNECT + SPEAK -> Chỉ người được mời mới thấy và vào được phòng
   */
  async grantMeetingRoomPermissions(params: {
    channelId: string;
    userIds: string[];
    lockEveryone?: boolean;
  }): Promise<{ success: boolean; grantedCount: number; totalUsers: number; errors: string[] }> {
    const { channelId, userIds, lockEveryone = true } = params;
    if (!this.token || !channelId || !userIds.length) {
      return { success: false, grantedCount: 0, totalUsers: userIds.length, errors: ["Missing token, channelId or userIds"] };
    }

    let grantedCount = 0;
    const errors: string[] = [];

    // 1. Tự động Deny @everyone để đảm bảo phòng voice là Private (kể cả khi phòng trên Discord ban đầu là Public)
    if (lockEveryone && this.guildId) {
      try {
        const lockRes = await fetch(
          `${this.baseUrl}/channels/${channelId}/permissions/${this.guildId}`,
          {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify({
              id: this.guildId,
              type: 0, // 0 = Role Overwrite (@everyone)
              allow: "0",
              deny: DISCORD_VOICE_PERMISSIONS.DEFAULT_DENY_EVERYONE,
            }),
            signal: AbortSignal.timeout(6000),
          },
        );

        if (!lockRes.ok && lockRes.status !== 204) {
          const errText = await lockRes.text().catch(() => "");
          errors.push(`Lock @everyone (${this.guildId}): HTTP ${lockRes.status} ${errText}`);
        }
      } catch (err: any) {
        errors.push(`Lock @everyone: ${err?.message}`);
      }
    }

    // 2. Cấp quyền Allow cho danh sách người tham gia
    const validUserIds = Array.from(new Set(userIds.filter((id) => /^\d{17,20}$/.test(id.trim()))));

    for (const userId of validUserIds) {
      try {
        const body = {
          id: userId,
          type: 1, // 1 = Member Overwrite
          allow: DISCORD_VOICE_PERMISSIONS.DEFAULT_ALLOW_VOICE,
          deny: "0",
        };

        const res = await fetch(`${this.baseUrl}/channels/${channelId}/permissions/${userId}`, {
          method: "PUT",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000),
        });

        if (res.status === 204 || res.ok) {
          grantedCount++;
        } else {
          const errText = await res.text().catch(() => "");
          errors.push(`User ${userId}: HTTP ${res.status} ${errText}`);
        }

        // Rate-limit safety: 120ms gap
        await new Promise((r) => setTimeout(r, 120));
      } catch (err: any) {
        errors.push(`User ${userId}: ${err?.message}`);
      }
    }

    return {
      success: grantedCount > 0,
      grantedCount,
      totalUsers: validUserIds.length,
      errors,
    };
  }

  /**
   * Thu hồi toàn bộ quyền thành viên (Reset Member Overwrites) khỏi Voice Channel
   * Trả phòng thoại về trạng thái riêng tư/mặc định ban đầu
   * Nếu unlockEveryone = true: Gỡ bỏ deny của @everyone để mở lại public
   */
  async resetMeetingRoomPermissions(
    channelId: string,
    options?: { unlockEveryone?: boolean },
  ): Promise<{
    success: boolean;
    resetCount: number;
    errors: string[];
  }> {
    if (!this.token || !channelId) {
      return { success: false, resetCount: 0, errors: ["Missing token or channelId"] };
    }

    try {
      // 1. Đọc chi tiết Channel để lấy danh sách permission_overwrites hiện có
      const chRes = await fetch(`${this.baseUrl}/channels/${channelId}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });

      if (!chRes.ok) {
        const errText = await chRes.text().catch(() => "");
        return { success: false, resetCount: 0, errors: [`Fetch channel failed: ${chRes.status} ${errText}`] };
      }

      const channelData = (await chRes.json()) as any;
      const overwrites: Array<{ id: string; type: number }> = channelData?.permission_overwrites || [];

      // 2. Lọc các overwrite dành riêng cho Member (type === 1)
      const memberOverwrites = overwrites.filter((o) => o.type === 1);
      let resetCount = 0;
      const errors: string[] = [];

      for (const overwrite of memberOverwrites) {
        try {
          const delRes = await fetch(
            `${this.baseUrl}/channels/${channelId}/permissions/${overwrite.id}`,
            {
              method: "DELETE",
              headers: this.getHeaders(),
              signal: AbortSignal.timeout(6000),
            },
          );

          if (delRes.status === 204 || delRes.ok || delRes.status === 404) {
            resetCount++;
          } else {
            const errText = await delRes.text().catch(() => "");
            errors.push(`Overwrite ${overwrite.id}: HTTP ${delRes.status} ${errText}`);
          }

          await new Promise((r) => setTimeout(r, 120));
        } catch (err: any) {
          errors.push(`Overwrite ${overwrite.id}: ${err?.message}`);
        }
      }

      // 3. Nếu được yêu cầu mở lại phòng thành public
      if (options?.unlockEveryone && this.guildId) {
        try {
          await fetch(
            `${this.baseUrl}/channels/${channelId}/permissions/${this.guildId}`,
            {
              method: "DELETE",
              headers: this.getHeaders(),
              signal: AbortSignal.timeout(6000),
            },
          );
        } catch (err: any) {
          errors.push(`Unlock @everyone: ${err?.message}`);
        }
      }

      // Xóa mốc thời gian empty sau khi reset xong
      this.channelEmptySince.delete(channelId);

      return {
        success: true,
        resetCount,
        errors,
      };
    } catch (err: any) {
      return { success: false, resetCount: 0, errors: [err?.message || "Unknown error"] };
    }
  }

  /**
   * Khóa phòng thoại đối với @everyone (chủ động biến thành phòng riêng tư)
   */
  async lockVoiceChannel(channelId: string): Promise<boolean> {
    if (!this.token || !this.guildId || !channelId) return false;
    try {
      const res = await fetch(
        `${this.baseUrl}/channels/${channelId}/permissions/${this.guildId}`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          body: JSON.stringify({
            id: this.guildId,
            type: 0,
            allow: "0",
            deny: DISCORD_VOICE_PERMISSIONS.DEFAULT_DENY_EVERYONE,
          }),
          signal: AbortSignal.timeout(6000),
        },
      );
      return res.ok || res.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Mở khóa phòng thoại đối với @everyone (trả về public)
   */
  async unlockVoiceChannel(channelId: string): Promise<boolean> {
    if (!this.token || !this.guildId || !channelId) return false;
    try {
      const res = await fetch(
        `${this.baseUrl}/channels/${channelId}/permissions/${this.guildId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(6000),
        },
      );
      return res.ok || res.status === 204 || res.status === 404;
    } catch {
      return false;
    }
  }

  /**
   * Kiểm tra điều kiện Hướng B:
   * Phòng họp có đang trống (0 thành viên) trong ít nhất `bufferMinutes` phút kể từ `meetingEndTime` hay không.
   */
  isMeetingRoomEmptyForDuration(
    channelId: string,
    bufferMinutes: number,
    meetingEndTime: Date | string,
  ): boolean {
    const endMs = new Date(meetingEndTime).getTime();
    const now = Date.now();

    // 1. Nếu chưa đến giờ kết thúc, tuyệt đối KHÔNG reset
    if (now < endMs) {
      return false;
    }

    // 2. Nếu phòng hiện tại vẫn còn người (memberCount > 0), cuộc họp đang overtime -> KHÔNG reset
    const memberCount = this.getVoiceChannelMemberCount(channelId);
    if (memberCount > 0) {
      return false;
    }

    // 3. Nếu phòng trống, xác định thời điểm bắt đầu tính trạng thái trống
    // Mốc bắt đầu không được sớm hơn meetingEndTime
    const recordedEmptySince = this.channelEmptySince.get(channelId) ?? endMs;
    const effectiveEmptyStart = Math.max(recordedEmptySince, endMs);

    const requiredDurationMs = bufferMinutes * 60 * 1000;
    const elapsedSinceEmpty = now - effectiveEmptyStart;

    return elapsedSinceEmpty >= requiredDurationMs;
  }

  /**
   * Lấy danh sách Roles trên Server Discord
   */
  async getGuildRoles(): Promise<
    Array<{ id: string; name: string; color: number }>
  > {
    if (!this.token || !this.guildId) return [];

    try {
      const res = await fetch(`${this.baseUrl}/guilds/${this.guildId}/roles`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.warn(`[DiscordBot] getGuildRoles error HTTP ${res.status}`);
        return [];
      }

      return (await res.json()) as any;
    } catch (err: any) {
      console.warn(`[DiscordBot] getGuildRoles failed:`, err?.message);
      return [];
    }
  }

  /**
   * Lấy danh sách tất cả các Active Threads trên Server Discord
   */
  async getGuildActiveThreads(): Promise<
    Array<{ id: string; name: string; parentId: string; type: number }>
  > {
    if (!this.token || !this.guildId) return [];

    try {
      const res = await fetch(
        `${this.baseUrl}/guilds/${this.guildId}/threads/active`,
        {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(6000),
        },
      );

      if (!res.ok) {
        console.warn(`[DiscordBot] getGuildActiveThreads error HTTP ${res.status}`);
        return [];
      }

      const data = (await res.json()) as any;
      const list = Array.isArray(data?.threads) ? data.threads : [];
      return list.map((t: any) => ({
        id: t.id,
        name: t.name,
        parentId: t.parent_id,
        type: t.type,
      }));
    } catch (err: any) {
      console.warn(`[DiscordBot] getGuildActiveThreads failed:`, err?.message);
      return [];
    }
  }

  /**
   * Tìm Parent Channel ID tối ưu để tạo Private Thread (ví dụ: kênh daily-standup hoặc task-board)
   */
  async resolveParentChannelId(preferredPurpose?: string): Promise<string | null> {
    // 1. Kiểm tra trong DB xem đã có WebhookConfig nào đang dùng chưa
    if (preferredPurpose) {
      const config = await prisma.discordWebhookConfig.findFirst({
        where: {
          purpose: preferredPurpose as any,
          isEnabled: true,
          webhookUrl: { contains: "/webhooks/" },
        },
        select: { webhookUrl: true },
      });

      if (config?.webhookUrl) {
        // Trích xuất channelId nếu URL có dạng webhook
        const match = config.webhookUrl.match(/\/webhooks\/(\d+)\//);
        if (match) {
          // Webhook ID thường không phải là channel ID, nên ta query Discord để lấy channel_id của webhook
          try {
            const hookRes = await fetch(config.webhookUrl, {
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(3000),
            });
            if (hookRes.ok) {
              const hookData = (await hookRes.json()) as any;
              if (hookData.channel_id) {
                return hookData.channel_id;
              }
            }
          } catch {
            // Tiếp tục fallback
          }
        }
      }
    }

    // 2. Quét danh sách channels trên server
    const channels = await this.getGuildChannels();
    const textChannels = channels.filter((c) => c.type === 0); // GUILD_TEXT = 0

    // Ưu tiên tìm kênh có tên standup hoặc task-board hoặc chung
    const standupChannel = textChannels.find((c) =>
      c.name.toLowerCase().includes("standup"),
    );
    if (standupChannel) return standupChannel.id;

    const taskChannel = textChannels.find((c) =>
      c.name.toLowerCase().includes("task"),
    );
    if (taskChannel) return taskChannel.id;

    const chungChannel = textChannels.find(
      (c) =>
        c.name.toLowerCase().includes("chung") ||
        c.name.toLowerCase().includes("general"),
    );
    if (chungChannel) return chungChannel.id;

    return textChannels[0]?.id || null;
  }

  /**
   * Tạo 1 Role mới trên Server Discord
   */
  async createRole(options: CreateRoleOptions): Promise<{
    id: string;
    name: string;
    color: number;
  }> {
    if (!this.token || !this.guildId) {
      throw new Error("Discord Bot token hoặc Guild ID chưa được thiết lập");
    }

    const randomColor =
      options.color ??
      DISCORD_NEON_ROLE_COLORS[
        Math.floor(Math.random() * DISCORD_NEON_ROLE_COLORS.length)
      ];

    const body = {
      name: options.name,
      color: randomColor,
      hoist: false,
      mentionable: options.mentionable !== undefined ? options.mentionable : true,
    };

    const res = await fetch(`${this.baseUrl}/guilds/${this.guildId}/roles`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Không thể tạo Discord Role (${res.status}): ${errText || res.statusText}`,
      );
    }

    const role = (await res.json()) as any;
    return {
      id: role.id,
      name: role.name,
      color: role.color,
    };
  }

  /**
   * Xóa Role khỏi Server Discord
   */
  async deleteRole(roleId: string): Promise<boolean> {
    if (!this.token || !this.guildId || !roleId) return false;

    try {
      const res = await fetch(
        `${this.baseUrl}/guilds/${this.guildId}/roles/${roleId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(6000),
        },
      );

      return res.status === 204 || res.status === 404;
    } catch (err: any) {
      console.warn(
        `[DiscordBot] deleteRole ${roleId} failed: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Tạo Private Thread (Luồng riêng tư) bên dưới Kênh cha
   */
  async createPrivateThread(options: CreatePrivateThreadOptions): Promise<{
    id: string;
    name: string;
    parentId: string;
  }> {
    if (!this.token) {
      throw new Error("Discord Bot token chưa được thiết lập");
    }

    const body = {
      name: options.name,
      type: 12, // GUILD_PRIVATE_THREAD
      auto_archive_duration: options.autoArchiveDuration || 10080, // 7 days (tối đa)
      invitable: options.invitable !== undefined ? options.invitable : false,
    };

    const res = await fetch(
      `${this.baseUrl}/channels/${options.channelId}/threads`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Không thể tạo Discord Private Thread (${res.status}): ${errText || res.statusText}`,
      );
    }

    const thread = (await res.json()) as any;
    return {
      id: thread.id,
      name: thread.name,
      parentId: thread.parent_id || options.channelId,
    };
  }

  /**
   * Xóa Private Thread
   */
  async deleteThread(threadId: string): Promise<boolean> {
    if (!this.token || !threadId) return false;

    try {
      const res = await fetch(`${this.baseUrl}/channels/${threadId}`, {
        method: "DELETE",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });

      return res.status === 200 || res.status === 204 || res.status === 404;
    } catch (err: any) {
      console.warn(
        `[DiscordBot] deleteThread ${threadId} failed: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Lưu trữ (Archive) Private Thread để bảo toàn lịch sử chat thay vì xóa vĩnh viễn
   */
  async archiveThread(threadId: string): Promise<boolean> {
    if (!this.token || !threadId) return false;

    try {
      const res = await fetch(`${this.baseUrl}/channels/${threadId}`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({ archived: true, locked: true }),
        signal: AbortSignal.timeout(6000),
      });

      return res.ok || res.status === 404;
    } catch (err: any) {
      console.warn(
        `[DiscordBot] archiveThread ${threadId} failed: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Gán Role phòng ban cho Discord User ID của Thực tập sinh
   */
  async addMemberToRole(params: {
    userId: string;
    roleId: string;
  }): Promise<boolean> {
    if (!this.token || !this.guildId || !params.userId || !params.roleId) {
      return false;
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/guilds/${this.guildId}/members/${params.userId}/roles/${params.roleId}`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (res.status === 204) return true;
      const err = await res.text().catch(() => "");
      console.warn(
        `[DiscordBot] addMemberToRole HTTP ${res.status}: ${err}`,
      );
      return false;
    } catch (err: any) {
      console.warn(`[DiscordBot] addMemberToRole failed: ${err?.message}`);
      return false;
    }
  }

  /**
   * Thu hồi Role phòng ban từ Discord User ID của Thực tập sinh
   */
  async removeMemberFromRole(params: {
    userId: string;
    roleId: string;
  }): Promise<boolean> {
    if (!this.token || !this.guildId || !params.userId || !params.roleId) {
      return false;
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/guilds/${this.guildId}/members/${params.userId}/roles/${params.roleId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        },
      );

      return res.status === 204 || res.status === 404;
    } catch (err: any) {
      console.warn(`[DiscordBot] removeMemberFromRole failed: ${err?.message}`);
      return false;
    }
  }

  /**
   * Thêm Thực tập sinh vào Private Thread của phòng ban
   */
  async addMemberToThread(
    params: {
      threadId: string;
      userId: string;
    },
    retryCount = 0,
  ): Promise<boolean> {
    if (!this.token || !params.threadId || !params.userId) return false;

    try {
      const res = await fetch(
        `${this.baseUrl}/channels/${params.threadId}/thread-members/${params.userId}`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (res.status === 204) return true;

      if (res.status === 429 && retryCount < 2) {
        const errJson = (await res.json().catch(() => ({}))) as any;
        const retryAfter =
          typeof errJson?.retry_after === "number" ? errJson.retry_after : 1;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.ceil(retryAfter * 1000) + 150),
        );
        return this.addMemberToThread(params, retryCount + 1);
      }

      const err = await res.text().catch(() => "");
      console.warn(
        `[DiscordBot] addMemberToThread HTTP ${res.status}: ${err}`,
      );
      return false;
    } catch (err: any) {
      console.warn(`[DiscordBot] addMemberToThread failed: ${err?.message}`);
      return false;
    }
  }

  /**
   * Xóa Thực tập sinh khỏi Private Thread của phòng ban
   */
  async removeMemberFromThread(params: {
    threadId: string;
    userId: string;
  }): Promise<boolean> {
    if (!this.token || !params.threadId || !params.userId) return false;

    try {
      const res = await fetch(
        `${this.baseUrl}/channels/${params.threadId}/thread-members/${params.userId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(10000),
        },
      );

      return res.status === 204 || res.status === 404;
    } catch (err: any) {
      console.warn(
        `[DiscordBot] removeMemberFromThread failed: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Tự động khởi tạo Role & Private Thread cho Phòng ban (Zero-touch Provisioning)
   * Sử dụng mutex in-memory để chống gọi đồng thời/trùng lặp khi nhấn nhiều lần
   */
  async provisionDepartment(params: {
    departmentId: string;
    departmentName: string;
    parentChannelId?: string;
  }): Promise<ProvisionDepartmentResult> {
    const existing = this.activeProvisions.get(params.departmentId);
    if (existing) {
      return existing;
    }

    const promise = this.executeProvisionDepartment(params).finally(() => {
      this.activeProvisions.delete(params.departmentId);
    });

    this.activeProvisions.set(params.departmentId, promise);
    return promise;
  }

  private async executeProvisionDepartment(params: {
    departmentId: string;
    departmentName: string;
    parentChannelId?: string;
  }): Promise<ProvisionDepartmentResult> {
    const { departmentId, departmentName } = params;

    // 1. Kiểm tra cấu hình hiện có trong DB qua Repository
    const existingConfigs = await discordWebhookRepository.findByDepartmentId(departmentId);

    let discordRoleId = existingConfigs.find((c) => c.discordRoleId)?.discordRoleId || null;
    let standupThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP)?.threadId || null;
    let taskThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.TASK_BOARD)?.threadId || null;
    let meetingThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM)?.threadId || null;

    const deptShortName = departmentName.split("(")[0].trim().replace(/^Ban\s+/i, "");
    let roleName = `Ban ${deptShortName}`;
    let isNewlyCreated = false;

    // 2. Kiểm tra Role: nếu DB chưa có discordRoleId, kiểm tra xem trên Discord đã có Role này chưa trước khi tạo mới
    if (!discordRoleId) {
      const guildRoles = await this.getGuildRoles();
      const existingRole = guildRoles.find((r) => {
        const rName = r.name.trim().toLowerCase();
        return (
          rName === roleName.trim().toLowerCase() ||
          rName === `ban ${deptShortName.toLowerCase()}` ||
          rName === deptShortName.toLowerCase()
        );
      });

      if (existingRole) {
        discordRoleId = existingRole.id;
        roleName = existingRole.name;
      } else {
        try {
          const newRole = await this.createRole({
            name: roleName,
            mentionable: true,
          });
          discordRoleId = newRole.id;
          roleName = newRole.name;
          isNewlyCreated = true;
        } catch (err: any) {
          console.warn(
            `[DiscordBot] provisionDepartment createRole warning:`,
            err.message,
          );
        }
      }
    }

    // 3. Lấy thông tin Server Owner để tự động add vào threads
    let ownerId: string | null = null;
    if (this.guildId) {
      try {
        const guildRes = await fetch(`${this.baseUrl}/guilds/${this.guildId}`, {
          headers: this.getHeaders(),
        });
        if (guildRes.ok) {
          const g = (await guildRes.json()) as any;
          ownerId = g.owner_id || null;
        }
      } catch {
        // ignore
      }
    }

    // 4. Lấy danh sách channels & active threads trên Guild
    const [channels, activeThreads] = await Promise.all([
      this.getGuildChannels(),
      this.getGuildActiveThreads(),
    ]);

    const standupCh = channels.find((c) => c.name.includes("standup") || c.name.includes("daily"));
    const taskCh = channels.find((c) => c.name.includes("task"));
    const meetingCh = channels.find((c) => c.name.includes("meeting"));

    const resolveThread = async (
      threadType: "Standup" | "Task Board" | "Meeting Room",
      currentDbThreadId: string | null,
      parentCh: { id: string; name: string } | undefined,
    ): Promise<string | null> => {
      const expectedName = `🔒 [${deptShortName}] ${threadType}`;

      // Nếu DB đã có threadId và thread này còn tồn tại trên server -> giữ nguyên
      if (currentDbThreadId) {
        const existsOnDiscord = activeThreads.some((t) => t.id === currentDbThreadId);
        if (existsOnDiscord) {
          // Lưu trữ (Archive) các threads trùng lặp rác nếu có trên cùng parentCh để bảo toàn lịch sử chat
          const duplicates = activeThreads.filter(
            (t) =>
              t.id !== currentDbThreadId &&
              t.name.trim().toLowerCase() === expectedName.toLowerCase() &&
              (!parentCh || t.parentId === parentCh.id),
          );
          for (const dup of duplicates) {
            await this.archiveThread(dup.id).catch(() => {});
          }
          return currentDbThreadId;
        }
      }

      // Nếu DB chưa có (hoặc thread cũ đã bị xóa), kiểm tra xem trên Discord đã có thread cùng tên chưa
      const matchingThreads = activeThreads.filter((t) => {
        const tName = t.name.trim().toLowerCase();
        const expName = expectedName.toLowerCase();
        const altName = `🔒 [ban ${deptShortName.toLowerCase()}] ${threadType.toLowerCase()}`;
        const isMatch = tName === expName || tName === altName;
        if (!isMatch) return false;
        if (parentCh && t.parentId !== parentCh.id) return false;
        return true;
      });

      if (matchingThreads.length > 0) {
        const primary = matchingThreads[0];
        // Lưu trữ (Archive) các thread trùng lặp dư thừa
        if (matchingThreads.length > 1) {
          for (let i = 1; i < matchingThreads.length; i++) {
            await this.archiveThread(matchingThreads[i].id).catch(() => {});
          }
        }
        return primary.id;
      }

      // Chỉ tạo mới khi trên Discord hoàn toàn chưa có thread này
      if (parentCh) {
        try {
          const newThread = await this.createPrivateThread({
            channelId: parentCh.id,
            name: expectedName,
          });
          isNewlyCreated = true;
          return newThread.id;
        } catch (err: any) {
          console.warn(`[DiscordBot] create ${threadType} thread warning:`, err.message);
        }
      }

      return null;
    };

    standupThreadId = await resolveThread("Standup", standupThreadId, standupCh);
    taskThreadId = await resolveThread("Task Board", taskThreadId, taskCh);
    meetingThreadId = await resolveThread("Meeting Room", meetingThreadId, meetingCh);

    // Tự động thêm thành viên vào 3 Threads:
    // 1. Server Owner
    // 2. Mọi ADMIN có discordUserId (ADMIN mặc định luôn được thêm vào các thread discord)
    // 3. Leader của phòng ban (nếu phòng ban có Leader và Leader có discordUserId)
    const membersToAdd = new Set<string>();
    if (ownerId) membersToAdd.add(ownerId);

    try {
      const threadMemberDiscordIds =
        await discordWebhookRepository.findThreadMemberDiscordIds(departmentId);
      for (const id of threadMemberDiscordIds) {
        membersToAdd.add(id);
        if (discordRoleId) {
          await this.addMemberToRole({ userId: id, roleId: discordRoleId }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn(`[DiscordBot] Fetch thread members failed:`, err?.message);
    }

    const createdThreadIds = [standupThreadId, taskThreadId, meetingThreadId].filter(Boolean) as string[];
    for (const threadId of createdThreadIds) {
      for (const userId of membersToAdd) {
        await this.addMemberToThread({ threadId, userId }).catch(() => {});
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    const resolveWebhookUrlForPurpose = (purpose: string): string => {
      // 1. Kiểm tra cấu hình hiện có của chính phòng ban này
      const currentConfig = existingConfigs.find(
        (c) =>
          c.purpose === purpose &&
          c.webhookUrl &&
          !c.webhookUrl.includes("placeholder-token"),
      );
      if (currentConfig?.webhookUrl) return currentConfig.webhookUrl;

      // 2. Fallback cấu hình hệ thống hoặc placeholder (tuyệt đối không mượn webhook của phòng ban khác)
      return (
        process.env.DISCORD_STANDUP_WEBHOOK ||
        process.env.DISCORD_WEBHOOK_URL ||
        "https://discord.com/api/webhooks/000000000000000000/placeholder-token"
      );
    };

    const updateOrCreateConfig = async (
      purpose: (typeof DISCORD_WEBHOOK_PURPOSE)[keyof typeof DISCORD_WEBHOOK_PURPOSE],
      threadId: string | null,
    ) => {
      const webhookUrl = resolveWebhookUrlForPurpose(purpose);
      await discordWebhookRepository.upsertDepartmentConfigWithDeduplication({
        departmentId,
        purpose,
        defaultWebhookUrl: webhookUrl,
        discordRoleId,
        threadId,
      });
    };

    await updateOrCreateConfig(DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP, standupThreadId);
    await updateOrCreateConfig(DISCORD_WEBHOOK_PURPOSE.TASK_BOARD, taskThreadId);
    await updateOrCreateConfig(DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM, meetingThreadId);

    return {
      departmentId,
      departmentName,
      discordRoleId: discordRoleId || "",
      roleName,
      threadId: standupThreadId || "",
      threadName: `🔒 [${deptShortName}] Standup`,
      parentChannelId: standupCh?.id || "",
      isNewlyCreated,
    };
  }

  /**
   * Tự động dọn dẹp Role & Tất cả Private Threads khi xóa phòng ban
   */
  async deprovisionDepartment(departmentId: string): Promise<{
    success: boolean;
    deletedRole: boolean;
    deletedThread: boolean;
  }> {
    const configs = await prisma.discordWebhookConfig.findMany({
      where: { departmentId },
      select: { discordRoleId: true, threadId: true },
    });

    let roleDeleted = false;
    let threadDeleted = false;

    const roleId = configs.find((c) => c.discordRoleId)?.discordRoleId;
    if (roleId) {
      roleDeleted = await this.deleteRole(roleId);
    }

    for (const c of configs) {
      if (c.threadId) {
        const ok = await this.deleteThread(c.threadId);
        if (ok) threadDeleted = true;
      }
    }

    return {
      success: true,
      deletedRole: roleDeleted,
      deletedThread: threadDeleted,
    };
  }

  /**
   * Đồng bộ quyền Discord cho Thực tập sinh khi Onboarding, đổi ban hoặc hoàn thành
   */
  async syncInternMember(params: {
    internId: string;
    discordUserId?: string | null;
    departmentId?: string | null;
    oldDepartmentId?: string | null;
  }): Promise<{ success: boolean; message: string }> {
    const { internId, oldDepartmentId } = params;
    let discordUserId = params.discordUserId;
    let departmentId = params.departmentId;

    if (departmentId === undefined || discordUserId === undefined) {
      const internData = await prisma.intern.findUnique({
        where: { id: internId },
        select: { departmentId: true, discordUserId: true },
      });
      if (departmentId === undefined) departmentId = internData?.departmentId || null;
      if (discordUserId === undefined) discordUserId = internData?.discordUserId || null;
    }

    if (!discordUserId) {
      return {
        success: false,
        message: "Intern chưa cung cấp Discord User ID.",
      };
    }

    // 1. Nếu đổi ban hoặc thu hồi ban: Thu hồi Role và rời khỏi TẤT CẢ Private Threads của ban cũ
    let targetOldDept = oldDepartmentId;
    if (!targetOldDept && (departmentId === null || departmentId === undefined)) {
      const internData = await prisma.intern.findUnique({
        where: { id: internId },
        select: { departmentId: true },
      });
      targetOldDept = internData?.departmentId || null;
    }

    if (targetOldDept && targetOldDept !== departmentId) {
      const oldConfigs = await prisma.discordWebhookConfig.findMany({
        where: { departmentId: targetOldDept },
        select: { discordRoleId: true, threadId: true },
      });

      const oldRoleId = oldConfigs.find((c) => c.discordRoleId)?.discordRoleId;
      if (oldRoleId) {
        await this.removeMemberFromRole({
          userId: discordUserId,
          roleId: oldRoleId,
        });
      }

      for (const c of oldConfigs) {
        if (c.threadId) {
          await this.removeMemberFromThread({
            userId: discordUserId,
            threadId: c.threadId,
          });
        }
      }
    }

    // 2. Nếu có departmentId mới: Gán Role và thêm vào TẤT CẢ Private Threads của ban mới
    if (departmentId) {
      let newConfigs = await prisma.discordWebhookConfig.findMany({
        where: { departmentId },
        select: { discordRoleId: true, threadId: true },
      });

      let roleId = newConfigs.find((c) => c.discordRoleId)?.discordRoleId;
      const hasThreads = newConfigs.some((c) => Boolean(c.threadId));

      // Nếu phòng ban chưa có Role hoặc Thread, tự động provision ngay
      if (!roleId || !hasThreads) {
        const dept = await prisma.department.findUnique({
          where: { id: departmentId },
          select: { name: true },
        });
        if (dept) {
          await this.provisionDepartment({
            departmentId,
            departmentName: dept.name,
          });
          newConfigs = await prisma.discordWebhookConfig.findMany({
            where: { departmentId },
            select: { discordRoleId: true, threadId: true },
          });
          roleId = newConfigs.find((c) => c.discordRoleId)?.discordRoleId;
        }
      }

      let roleAssigned = false;
      let threadJoined = false;

      if (roleId) {
        roleAssigned = await this.addMemberToRole({
          userId: discordUserId,
          roleId,
        });
      }

      for (const c of newConfigs) {
        if (c.threadId) {
          const joined = await this.addMemberToThread({
            userId: discordUserId,
            threadId: c.threadId,
          });
          if (joined) threadJoined = true;
        }
      }

      // Cập nhật trạng thái discordRoleGranted trong bảng Intern
      await prisma.intern.update({
        where: { id: internId },
        data: {
          discordRoleGranted: roleAssigned || threadJoined,
          ...(discordUserId ? { discordUserId } : {}),
        },
      });

      return {
        success: true,
        message: `Đã phân quyền Discord: Role=${roleAssigned ? "OK" : "SKIP"}, Threads=${threadJoined ? "OK" : "SKIP"}`,
      };
    }

    // 3. Nếu không có departmentId mới (thu hồi quyền): Cập nhật discordRoleGranted = false
    await prisma.intern.update({
      where: { id: internId },
      data: {
        discordRoleGranted: false,
      },
    });

    return {
      success: true,
      message: "Đã thu hồi quyền Discord phòng ban thành công.",
    };
  }

  /**
   * Thêm Admin vào TẤT CẢ Private Threads của mọi phòng ban
   */
  async syncAdminThreads(discordUserId: string): Promise<number> {
    if (!this.token || !discordUserId) return 0;
    try {
      const configs = await prisma.discordWebhookConfig.findMany({
        where: {
          threadId: { not: null },
          isEnabled: true,
        },
        select: { threadId: true },
      });

      const uniqueThreadIds = Array.from(
        new Set(configs.map((c) => c.threadId).filter(Boolean)),
      ) as string[];

      let count = 0;
      for (const threadId of uniqueThreadIds) {
        const ok = await this.addMemberToThread({
          threadId,
          userId: discordUserId,
        });
        if (ok) count++;
        await new Promise((r) => setTimeout(r, 200));
      }
      return count;
    } catch (err: any) {
      console.warn(`[DiscordBot] syncAdminThreads failed:`, err?.message);
      return 0;
    }
  }

  /**
   * Thêm Leader vào các Private Threads & Role của các phòng ban họ phụ trách
   */
  async syncLeaderThreads(
    leaderUserId: string,
    targetDiscordUserId?: string,
  ): Promise<number> {
    if (!this.token) return 0;
    try {
      let discordUserId = targetDiscordUserId;
      if (!discordUserId) {
        const u = await prisma.user.findUnique({
          where: { id: leaderUserId },
          select: { discordUserId: true },
        });
        discordUserId = u?.discordUserId || undefined;
      }
      if (!discordUserId) return 0;

      const managers = await prisma.departmentManager.findMany({
        where: { userId: leaderUserId },
        select: { departmentId: true },
      });

      if (managers.length === 0) return 0;
      const departmentIds = managers.map((d) => d.departmentId);


      const configs = await prisma.discordWebhookConfig.findMany({
        where: {
          departmentId: { in: departmentIds },
          isEnabled: true,
        },
        select: { threadId: true, discordRoleId: true },
      });

      let count = 0;
      for (const c of configs) {
        if (c.threadId) {
          const ok = await this.addMemberToThread({
            threadId: c.threadId,
            userId: discordUserId,
          });
          if (ok) count++;
          await new Promise((r) => setTimeout(r, 200));
        }
        if (c.discordRoleId) {
          await this.addMemberToRole({
            userId: discordUserId,
            roleId: c.discordRoleId,
          });
        }
      }
      return count;
    } catch (err: any) {
      console.warn(`[DiscordBot] syncLeaderThreads failed:`, err?.message);
      return 0;
    }
  }

  /**
   * Quét và đồng bộ Role Discord hàng loạt (Batch Role Sync Engine)
   */
  async batchSyncRoles(
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
    options: { force?: boolean } = {},
  ): Promise<BatchSyncRolesResult> {
    const interns = await prisma.intern.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            discordUserId: true,
            discordUsername: true,
          },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const details: BatchSyncRoleDetail[] = [];
    let grantedCount = 0;
    let revokedCount = 0;
    let alreadySyncedCount = 0;
    let missingIdCount = 0;
    let failedCount = 0;

    for (const intern of interns) {
      const email = intern.user?.email || "";
      const fullName = intern.fullName || intern.user?.fullName || "Thực tập sinh";
      const departmentName = intern.department?.name || "Chưa phân ban";
      const internCode = intern.internCode || intern.id.slice(0, 8).toUpperCase();

      const rawDiscordId =
        intern.discordUserId ||
        intern.user?.discordUserId ||
        (intern.discordUsername && /^\d{17,20}$/.test(intern.discordUsername)
          ? intern.discordUsername
          : null);
      const validDiscordId =
        rawDiscordId && /^\d{17,20}$/.test(rawDiscordId.trim())
          ? rawDiscordId.trim()
          : null;

      try {
        if (intern.status === "ACTIVE") {
          if (!validDiscordId) {
            missingIdCount++;
            details.push({
              internId: intern.id,
              internCode,
              fullName,
              email,
              departmentName,
              discordUserId: null,
              status: "MISSING_ID",
              message: "Chưa liên kết Discord User ID",
            });
            continue;
          }

          if (!intern.discordRoleGranted || options?.force) {
            if (!intern.departmentId) {
              missingIdCount++;
              details.push({
                internId: intern.id,
                internCode,
                fullName,
                email,
                departmentName,
                discordUserId: validDiscordId,
                status: "MISSING_ID",
                message: "Chưa được phân bổ phòng ban",
              });
              continue;
            }

            const syncRes = await this.syncInternMember({
              internId: intern.id,
              discordUserId: validDiscordId,
              departmentId: intern.departmentId,
            });

            grantedCount++;
            details.push({
              internId: intern.id,
              internCode,
              fullName,
              email,
              departmentName,
              discordUserId: validDiscordId,
              status: "GRANTED",
              message:
                syncRes.message ||
                "Đã cấp Role phòng ban và Private Threads thành công",
            });

            await new Promise((r) => setTimeout(r, 120));
          } else {
            alreadySyncedCount++;
            details.push({
              internId: intern.id,
              internCode,
              fullName,
              email,
              departmentName,
              discordUserId: validDiscordId,
              status: "ALREADY_SYNCED",
              message: "Đã có đủ quyền Discord phòng ban",
            });
          }
        } else if (
          intern.status === "COMPLETED" ||
          intern.status === "DROPPED"
        ) {
          if (intern.discordRoleGranted) {
            await this.syncInternMember({
              internId: intern.id,
              discordUserId: validDiscordId || undefined,
              departmentId: null,
              oldDepartmentId: intern.departmentId,
            });

            revokedCount++;
            details.push({
              internId: intern.id,
              internCode,
              fullName,
              email,
              departmentName,
              discordUserId: validDiscordId,
              status: "REVOKED",
              message: "Đã thu hồi Role phòng ban và xóa khỏi Private Threads",
            });

            await new Promise((r) => setTimeout(r, 120));
          } else {
            alreadySyncedCount++;
            details.push({
              internId: intern.id,
              internCode,
              fullName,
              email,
              departmentName,
              discordUserId: validDiscordId,
              status: "ALREADY_SYNCED",
              message: `Đã kết thúc thực tập (${intern.status}), không có Role cần thu hồi`,
            });
          }
        } else {
          alreadySyncedCount++;
        }
      } catch (err: any) {
        failedCount++;
        details.push({
          internId: intern.id,
          internCode,
          fullName,
          email,
          departmentName,
          discordUserId: validDiscordId,
          status: "FAILED",
          message: err?.message || "Lỗi khi xử lý đồng bộ Discord",
        });
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorContext?.actorId || null,
          action: AUDIT_ACTION.BATCH_SYNC_DISCORD_ROLES,
          targetType: "SYSTEM",
          targetId: "DISCORD_ROLES",
          details: {
            totalScanned: interns.length,
            grantedCount,
            revokedCount,
            alreadySyncedCount,
            missingIdCount,
            failedCount,
          },
          ipAddress: actorContext?.ipAddress || null,
          userAgent: actorContext?.userAgent || null,
        },
      });
    } catch (auditErr: any) {
      console.warn(
        `[DiscordBot] Failed to create audit log for batchSyncRoles:`,
        auditErr?.message,
      );
    }

    return {
      totalScanned: interns.length,
      grantedCount,
      revokedCount,
      alreadySyncedCount,
      missingIdCount,
      failedCount,
      details,
    };
  }
}

export const discordBotService = new DiscordBotService();
