import { prisma } from "../../database/prisma.client";
import {
  CreateDiscordWebhookDto,
  DiscordWebhookFilterQuery,
  UpdateDiscordWebhookDto,
} from "./discord-webhook.dto";
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from "../../common/constants/audit-log.constant";

export class DiscordWebhookRepository {
  async findMany(filter: DiscordWebhookFilterQuery = {}) {
    const where: any = {};

    if (filter.scope) {
      where.scope = filter.scope;
    }
    if (filter.departmentId) {
      where.departmentId = filter.departmentId;
    }
    if (filter.taskGroupId) {
      where.taskGroupId = filter.taskGroupId;
    }
    if (filter.purpose) {
      where.purpose = filter.purpose;
    }
    if (filter.isEnabled !== undefined) {
      where.isEnabled = filter.isEnabled;
    }

    return prisma.discordWebhookConfig.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true },
        },
        taskGroup: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ scope: "asc" }, { purpose: "asc" }, { createdAt: "desc" }],
    });
  }

  async findById(id: string) {
    return prisma.discordWebhookConfig.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        taskGroup: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findExistingConfig(params: {
    purpose: any;
    scope: any;
    departmentId?: string | null;
    taskGroupId?: string | null;
  }) {
    return prisma.discordWebhookConfig.findFirst({
      where: {
        purpose: params.purpose,
        scope: params.scope,
        departmentId: params.departmentId || null,
        taskGroupId: params.taskGroupId || null,
      },
    });
  }

  async create(data: CreateDiscordWebhookDto) {
    return prisma.discordWebhookConfig.create({
      data: {
        scope: data.scope || "GLOBAL",
        departmentId: data.departmentId || null,
        taskGroupId: data.taskGroupId || null,
        purpose: data.purpose,
        webhookUrl: data.webhookUrl.trim(),
        discordRoleId: data.discordRoleId ? data.discordRoleId.trim() : null,
        threadId: data.threadId ? data.threadId.trim() : null,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      },
      include: {
        department: { select: { id: true, name: true } },
        taskGroup: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, data: UpdateDiscordWebhookDto) {
    return prisma.discordWebhookConfig.update({
      where: { id },
      data: {
        ...(data.scope ? { scope: data.scope } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.taskGroupId !== undefined ? { taskGroupId: data.taskGroupId } : {}),
        ...(data.purpose ? { purpose: data.purpose } : {}),
        ...(data.webhookUrl ? { webhookUrl: data.webhookUrl.trim() } : {}),
        ...(data.discordRoleId !== undefined
          ? { discordRoleId: data.discordRoleId ? data.discordRoleId.trim() : null }
          : {}),
        ...(data.threadId !== undefined
          ? { threadId: data.threadId ? data.threadId.trim() : null }
          : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        taskGroup: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.discordWebhookConfig.delete({
      where: { id },
    });
  }

  async departmentExists(id: string): Promise<boolean> {
    const dept = await prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });
    return Boolean(dept);
  }

  async taskGroupExists(id: string): Promise<boolean> {
    const tg = await prisma.taskGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    return Boolean(tg);
  }

  async updatePingStatus(
    id: string,
    data: {
      lastPingAt: Date;
      lastStatus: "SUCCESS" | "FAILED";
      lastError: string | null;
    },
  ) {
    return prisma.discordWebhookConfig.update({
      where: { id },
      data: {
        lastPingAt: data.lastPingAt,
        lastStatus: data.lastStatus,
        lastError: data.lastError,
      },
    });
  }

  async findWebhookForRouting(params: {
    purpose: any;
    departmentId?: string | null;
    taskGroupId?: string | null;
  }) {
    const { purpose, departmentId, taskGroupId } = params;

    // 1. Kiểm tra cấu hình cụ thể của TaskGroup nếu có
    if (taskGroupId) {
      const groupWebhook = await prisma.discordWebhookConfig.findFirst({
        where: {
          taskGroupId,
          purpose,
          isEnabled: true,
        },
      });
      if (groupWebhook) return groupWebhook;

      // Nếu taskGroup chưa có webhook riêng, tìm departmentId của TaskGroup
      if (!departmentId) {
        const tg = await prisma.taskGroup.findUnique({
          where: { id: taskGroupId },
          select: { departmentId: true },
        });
        if (tg?.departmentId) {
          const deptWebhook = await prisma.discordWebhookConfig.findFirst({
            where: {
              departmentId: tg.departmentId,
              purpose,
              isEnabled: true,
            },
          });
          if (deptWebhook) return deptWebhook;
        }
      }
    }

    // 2. Kiểm tra cấu hình theo Department
    if (departmentId) {
      const deptWebhook = await prisma.discordWebhookConfig.findFirst({
        where: {
          departmentId,
          purpose,
          isEnabled: true,
        },
      });
      if (deptWebhook) return deptWebhook;
    }

    // 3. Nếu là LEADERBOARD hoặc LEADER_ALERTS, cho phép kênh GLOBAL
    if (purpose === "LEADERBOARD" || purpose === "LEADER_ALERTS") {
      const globalWebhook = await prisma.discordWebhookConfig.findFirst({
        where: {
          scope: "GLOBAL",
          purpose,
          isEnabled: true,
        },
      });
      if (globalWebhook) return globalWebhook;
    }

    return null;
  }

  async count(where: any = {}) {
    return prisma.discordWebhookConfig.count({ where });
  }

  async createAuditLog(params: {
    actorId?: string;
    action: string;
    targetId: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        targetType: AUDIT_TARGET_TYPE.DISCORD_WEBHOOK,
        targetId: params.targetId,
        details: params.details || {},
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  }
}

export const discordWebhookRepository = new DiscordWebhookRepository();
