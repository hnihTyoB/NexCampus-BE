import { envConfig } from "../../config/env.config";
import { prisma } from "../../database/prisma.client";
import {
  DISCORD_NEON_ROLE_COLORS,
  DISCORD_WEBHOOK_PURPOSE,
  DISCORD_WEBHOOK_SCOPE,
} from "../constants/discord.constant";
import { ROLES } from "../constants/role.constant";

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

  setRuntimeConfig(config: { token?: string; guildId?: string; enabled?: boolean }): void {
    if (config.token !== undefined) this.runtimeToken = config.token.trim();
    if (config.guildId !== undefined) this.runtimeGuildId = config.guildId.trim();
    if (config.enabled !== undefined) this.runtimeEnabled = config.enabled;
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
   * Xóa hoặc Lưu trữ (Archive) Private Thread
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
   */
  async provisionDepartment(params: {
    departmentId: string;
    departmentName: string;
    parentChannelId?: string;
  }): Promise<ProvisionDepartmentResult> {
    const { departmentId, departmentName } = params;

    // 1. Kiểm tra cấu hình hiện có trong DB
    const existingConfigs = await prisma.discordWebhookConfig.findMany({
      where: { departmentId },
    });

    let discordRoleId = existingConfigs.find((c) => c.discordRoleId)?.discordRoleId || null;
    let standupThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP)?.threadId || null;
    let taskThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.TASK_BOARD)?.threadId || null;
    let meetingThreadId = existingConfigs.find((c) => c.purpose === DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM)?.threadId || null;

    const deptShortName = departmentName.split("(")[0].trim();
    let roleName = `Ban ${deptShortName}`;
    let isNewlyCreated = false;

    // 2. Tạo Role mới nếu chưa có
    if (!discordRoleId) {
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

    // 4. Lấy danh sách channels trên Guild
    const channels = await this.getGuildChannels();
    const standupCh = channels.find((c) => c.name.includes("standup") || c.name.includes("daily"));
    const taskCh = channels.find((c) => c.name.includes("task"));
    const meetingCh = channels.find((c) => c.name.includes("meeting"));

    // A. Tạo Private Thread cho Standup
    if (!standupThreadId && standupCh) {
      try {
        const st = await this.createPrivateThread({
          channelId: standupCh.id,
          name: `🔒 [${deptShortName}] Standup`,
        });
        standupThreadId = st.id;
        isNewlyCreated = true;
      } catch (err: any) {
        console.warn(`[DiscordBot] create Standup thread warning:`, err.message);
      }
    }

    // B. Tạo Private Thread cho Task Board
    if (!taskThreadId && taskCh) {
      try {
        const tt = await this.createPrivateThread({
          channelId: taskCh.id,
          name: `🔒 [${deptShortName}] Task Board`,
        });
        taskThreadId = tt.id;
        isNewlyCreated = true;
      } catch (err: any) {
        console.warn(`[DiscordBot] create Task Board thread warning:`, err.message);
      }
    }

    // C. Tạo Private Thread cho Meeting Room
    if (!meetingThreadId && meetingCh) {
      try {
        const mt = await this.createPrivateThread({
          channelId: meetingCh.id,
          name: `🔒 [${deptShortName}] Meeting Room`,
        });
        meetingThreadId = mt.id;
        isNewlyCreated = true;
      } catch (err: any) {
        console.warn(`[DiscordBot] create Meeting Room thread warning:`, err.message);
      }
    }

    // Tự động thêm thành viên vào 3 Threads:
    // 1. Server Owner
    // 2. Mọi ADMIN có discordUserId (ADMIN mặc định luôn được thêm vào các thread discord)
    // 3. Leader của phòng ban (nếu phòng ban có Leader và Leader có discordUserId)
    const membersToAdd = new Set<string>();
    if (ownerId) membersToAdd.add(ownerId);

    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          role: { name: ROLES.ADMIN },
          discordUserId: { not: null },
          deletedAt: null,
          isActive: true,
        },
        select: { discordUserId: true },
      });
      for (const a of adminUsers) {
        if (a.discordUserId) membersToAdd.add(a.discordUserId);
      }
    } catch (err: any) {
      console.warn(`[DiscordBot] Fetch admins for thread failed:`, err?.message);
    }

    try {
      const leaderAssignments = await prisma.leaderDepartment.findMany({
        where: { departmentId },
        include: {
          leader: {
            include: {
              user: {
                select: { discordUserId: true },
              },
            },
          },
        },
      });
      for (const la of leaderAssignments) {
        const leaderDiscordId = la.leader?.user?.discordUserId;
        if (leaderDiscordId) {
          membersToAdd.add(leaderDiscordId);
          if (discordRoleId) {
            await this.addMemberToRole({ userId: leaderDiscordId, roleId: discordRoleId }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.warn(`[DiscordBot] Fetch leaders for thread failed:`, err?.message);
    }

    const createdThreadIds = [standupThreadId, taskThreadId, meetingThreadId].filter(Boolean) as string[];
    for (const threadId of createdThreadIds) {
      for (const userId of membersToAdd) {
        await this.addMemberToThread({ threadId, userId }).catch(() => {});
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // 5. Cập nhật vào DB cho 3 records
    const defaultWebhookUrl =
      process.env.DISCORD_STANDUP_WEBHOOK ||
      process.env.DISCORD_WEBHOOK_URL ||
      "https://discord.com/api/webhooks/000000000000000000/placeholder-token";

    const updateOrCreateConfig = async (
      purpose: (typeof DISCORD_WEBHOOK_PURPOSE)[keyof typeof DISCORD_WEBHOOK_PURPOSE],
      threadId: string | null,
    ) => {
      const existing = existingConfigs.find((c) => c.purpose === purpose);
      if (existing) {
        await prisma.discordWebhookConfig.update({
          where: { id: existing.id },
          data: {
            ...(discordRoleId ? { discordRoleId } : {}),
            ...(threadId ? { threadId } : {}),
            isEnabled: true,
          },
        });
      } else {
        await prisma.discordWebhookConfig.create({
          data: {
            scope: DISCORD_WEBHOOK_SCOPE.DEPARTMENT,
            departmentId,
            purpose,
            webhookUrl: defaultWebhookUrl,
            discordRoleId,
            threadId,
            isEnabled: true,
          },
        });
      }
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

    // 1. Nếu đổi ban: Thu hồi Role và rời khỏi TẤT CẢ Private Threads của ban cũ
    if (oldDepartmentId && oldDepartmentId !== departmentId) {
      const oldConfigs = await prisma.discordWebhookConfig.findMany({
        where: { departmentId: oldDepartmentId },
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

    return {
      success: true,
      message: "Đã thu hồi quyền Discord ban cũ thành công.",
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

      const leader = await prisma.leader.findUnique({
        where: { userId: leaderUserId },
        include: {
          departments: {
            select: { departmentId: true },
          },
        },
      });

      if (!leader || leader.departments.length === 0) return 0;
      const departmentIds = leader.departments.map((d) => d.departmentId);

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
}

export const discordBotService = new DiscordBotService();
