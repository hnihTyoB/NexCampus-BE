import {
  discordWebhookRepository,
  DiscordWebhookRepository,
} from "./discord-webhook.repository";
import {
  CreateDiscordWebhookDto,
  DiscordWebhookFilterQuery,
  DiscordWebhookItemDto,
  TestDiscordWebhookDto,
  UpdateDiscordWebhookDto,
} from "./discord-webhook.dto";
import { discordWebhookService } from "../../common/services/discord-webhook.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { AUDIT_ACTION } from "../../common/constants/audit-log.constant";
import { discordBotService } from "../../common/services/discord-bot.service";
import { prisma } from "../../database/prisma.client";

export class DiscordWebhookManageService {
  constructor(
    private readonly repository: DiscordWebhookRepository = discordWebhookRepository,
  ) {}

  private mapToDto(item: any): DiscordWebhookItemDto {
    return {
      id: item.id,
      scope: item.scope,
      departmentId: item.departmentId,
      departmentName: item.department?.name || null,
      taskGroupId: item.taskGroupId,
      taskGroupName: item.taskGroup?.name || null,
      purpose: item.purpose,
      webhookUrl: discordWebhookService.maskWebhookUrl(item.webhookUrl),
      discordRoleId: item.discordRoleId,
      threadId: item.threadId || null,
      isEnabled: item.isEnabled,
      lastPingAt: item.lastPingAt,
      lastStatus: item.lastStatus,
      lastError: item.lastError,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async listWebhooks(filter: DiscordWebhookFilterQuery = {}): Promise<DiscordWebhookItemDto[]> {
    const items = await this.repository.findMany(filter);
    return items.map((item) => this.mapToDto(item));
  }

  async getWebhookById(id: string): Promise<DiscordWebhookItemDto> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError(
        "Cấu hình Discord Webhook không tồn tại",
        404,
        ERROR_CODE.DISCORD_WEBHOOK_NOT_FOUND,
      );
    }
    return this.mapToDto(item);
  }

  async createOrUpdateWebhook(
    data: CreateDiscordWebhookDto,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ data: DiscordWebhookItemDto; isCreated: boolean }> {
    if (!discordWebhookService.isValidWebhookUrl(data.webhookUrl)) {
      throw new AppError(
        "Định dạng URL Discord Webhook không hợp lệ",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Xác thực phạm vi (Scope)
    let resolvedScope = data.scope;
    if (data.taskGroupId) {
      resolvedScope = "TASK_GROUP";
      const tgExists = await this.repository.taskGroupExists(data.taskGroupId);
      if (!tgExists) {
        throw new AppError(
          "Nhóm công việc (Task Group) không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    } else if (data.departmentId) {
      resolvedScope = "DEPARTMENT";
      const deptExists = await this.repository.departmentExists(data.departmentId);
      if (!deptExists) {
        throw new AppError(
          "Phòng ban (Department) không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    } else {
      resolvedScope = "GLOBAL";
    }

    data.scope = resolvedScope;

    // Kiểm tra xem đã có cấu hình cho cùng Scope + Mục đích chưa (nếu có thì cập nhật)
    const existing = await this.repository.findExistingConfig({
      purpose: data.purpose,
      scope: resolvedScope,
      departmentId: data.departmentId,
      taskGroupId: data.taskGroupId,
    });

    let resultRecord: any;
    let isCreated = false;

    if (existing) {
      resultRecord = await this.repository.update(existing.id, {
        webhookUrl: data.webhookUrl,
        discordRoleId: data.discordRoleId,
        threadId: data.threadId,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      });

      await this.repository.createAuditLog({
        actorId: actorContext?.actorId,
        action: AUDIT_ACTION.UPDATE_DISCORD_WEBHOOK,
        targetId: existing.id,
        details: {
          scope: resolvedScope,
          purpose: data.purpose,
          departmentId: data.departmentId,
          taskGroupId: data.taskGroupId,
          threadId: data.threadId,
        },
        ipAddress: actorContext?.ipAddress,
        userAgent: actorContext?.userAgent,
      });
    } else {
      resultRecord = await this.repository.create(data);
      isCreated = true;

      await this.repository.createAuditLog({
        actorId: actorContext?.actorId,
        action: AUDIT_ACTION.CREATE_DISCORD_WEBHOOK,
        targetId: resultRecord.id,
        details: {
          scope: resolvedScope,
          purpose: data.purpose,
          departmentId: data.departmentId,
          taskGroupId: data.taskGroupId,
        },
        ipAddress: actorContext?.ipAddress,
        userAgent: actorContext?.userAgent,
      });
    }

    return {
      data: this.mapToDto(resultRecord),
      isCreated,
    };
  }

  async updateWebhook(
    id: string,
    data: UpdateDiscordWebhookDto,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<DiscordWebhookItemDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(
        "Cấu hình Discord Webhook không tồn tại",
        404,
        ERROR_CODE.DISCORD_WEBHOOK_NOT_FOUND,
      );
    }

    if (data.webhookUrl && !discordWebhookService.isValidWebhookUrl(data.webhookUrl)) {
      throw new AppError(
        "Định dạng URL Discord Webhook không hợp lệ",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (data.departmentId) {
      const deptExists = await this.repository.departmentExists(data.departmentId);
      if (!deptExists) {
        throw new AppError(
          "Phòng ban không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    if (data.taskGroupId) {
      const tgExists = await this.repository.taskGroupExists(data.taskGroupId);
      if (!tgExists) {
        throw new AppError(
          "Nhóm công việc không tồn tại",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    const updated = await this.repository.update(id, data);

    const safeUpdates = { ...data };
    if (safeUpdates.webhookUrl) {
      safeUpdates.webhookUrl = discordWebhookService.maskWebhookUrl(safeUpdates.webhookUrl);
    }

    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTION.UPDATE_DISCORD_WEBHOOK,
      targetId: id,
      details: {
        updates: safeUpdates,
      },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return this.mapToDto(updated);
  }

  async deleteWebhook(
    id: string,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(
        "Cấu hình Discord Webhook không tồn tại",
        404,
        ERROR_CODE.DISCORD_WEBHOOK_NOT_FOUND,
      );
    }

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTION.DELETE_DISCORD_WEBHOOK,
      targetId: id,
      details: {
        scope: existing.scope,
        purpose: existing.purpose,
        departmentId: existing.departmentId,
        taskGroupId: existing.taskGroupId,
      },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });
  }

  async testPingWebhook(
    payload: TestDiscordWebhookDto,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const testResult = await discordWebhookService.testPingWebhook({
      id: payload.id,
      webhookUrl: payload.webhookUrl,
      discordRoleId: payload.discordRoleId,
      channelName: payload.channelName,
    });

    if (payload.id) {
      await this.repository.createAuditLog({
        actorId: actorContext?.actorId,
        action: AUDIT_ACTION.TEST_DISCORD_WEBHOOK,
        targetId: payload.id,
        details: {
          success: testResult.success,
          statusCode: testResult.statusCode,
          message: testResult.message,
        },
        ipAddress: actorContext?.ipAddress,
        userAgent: actorContext?.userAgent,
      });
    }

    return testResult;
  }

  async getBotStatus() {
    return discordBotService.checkConnection();
  }

  async provisionDepartment(
    departmentId: string,
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!dept) {
      throw new AppError(
        "Phòng ban không tồn tại trong hệ thống",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const result = await discordBotService.provisionDepartment({
      departmentId: dept.id,
      departmentName: dept.name,
    });

    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: "PROVISION_DISCORD_DEPARTMENT",
      targetId: dept.id,
      details: {
        roleId: result.discordRoleId,
        threadId: result.threadId,
      },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return result;
  }

  /**
   * Provision toàn bộ phòng ban hiện có: Tạo Role & Private Thread nếu chưa có
   */
  async provisionAllDepartments(
    actorContext?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{
      departmentId: string;
      departmentName: string;
      success: boolean;
      discordRoleId?: string;
      threadId?: string;
      error?: string;
    }>;
  }> {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const results: Array<{
      departmentId: string;
      departmentName: string;
      success: boolean;
      discordRoleId?: string;
      threadId?: string;
      error?: string;
    }> = [];

    let succeeded = 0;
    let failed = 0;

    for (const dept of departments) {
      try {
        const result = await discordBotService.provisionDepartment({
          departmentId: dept.id,
          departmentName: dept.name,
        });

        results.push({
          departmentId: dept.id,
          departmentName: dept.name,
          success: true,
          discordRoleId: result.discordRoleId || undefined,
          threadId: result.threadId || undefined,
        });
        succeeded++;
      } catch (err: any) {
        results.push({
          departmentId: dept.id,
          departmentName: dept.name,
          success: false,
          error: err?.message || "Unknown error",
        });
        failed++;
        console.warn(
          `[DiscordWebhookManageService] provisionAllDepartments failed for ${dept.name}:`,
          err?.message,
        );
      }
    }

    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: "PROVISION_ALL_DISCORD_DEPARTMENTS",
      targetId: "SYSTEM",
      details: { total: departments.length, succeeded, failed },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    return { total: departments.length, succeeded, failed, results };
  }
}

export const discordWebhookManageService = new DiscordWebhookManageService();
