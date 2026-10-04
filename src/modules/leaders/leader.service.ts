import { LeaderRepository } from "./leader.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  LeaderQueryDto,
  CreateLeaderDto,
  UpdateLeaderDto,
  UpdateMeLeaderDto,
  BatchUpdateLeaderItemDto,
  LeaderDto,
  MAX_LEADER_DEPARTMENTS,
} from "./leader.dto";
import { prisma } from "../../database/prisma.client";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { ROLES } from "../../common/constants/role.constant";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { systemConfigService } from "../system-config/system-config.service";
import { HRM_CONFIG_KEYS } from "../../common/constants/system-config.constant";
import { discordBotService } from "../../common/services/discord-bot.service";

export class LeaderService {
  private readonly repository = new LeaderRepository();

  private normalizeDepartmentIds(data: {
    departmentIds?: string[];
    departmentId?: string | null;
  }): string[] | undefined {
    if (data.departmentIds !== undefined) {
      return data.departmentIds;
    }
    if (data.departmentId !== undefined) {
      return data.departmentId ? [data.departmentId] : [];
    }
    return undefined;
  }

  private async validateDepartments(departmentIds: string[]): Promise<void> {
    const maxAllowed = await systemConfigService.get<number>(
      HRM_CONFIG_KEYS.MAX_LEADER_DEPARTMENTS,
      MAX_LEADER_DEPARTMENTS,
    );

    if (departmentIds.length > maxAllowed) {
      throw new AppError(
        `A leader can manage at most ${maxAllowed} departments`,
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const uniqueIds = new Set(departmentIds);
    if (uniqueIds.size !== departmentIds.length) {
      throw new AppError(
        "departmentIds must not contain duplicates",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (departmentIds.length === 0) return;

    const departmentCount = await prisma.department.count({
      where: { id: { in: departmentIds }, deletedAt: null },
    });
    if (departmentCount !== departmentIds.length) {
      throw new AppError(
        "Một hoặc nhiều phòng ban được chọn không tồn tại hoặc đã bị xóa",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
  }

  async findAll(query: LeaderQueryDto): Promise<{
    data: LeaderDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    return this.repository.findAll(query);
  }

  async findById(id: string): Promise<LeaderDto> {
    const leader = await this.repository.findById(id);
    if (!leader) {
      throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
    }
    return leader;
  }

  async create(data: CreateLeaderDto, actorId?: string): Promise<LeaderDto> {
    const departmentIds = this.normalizeDepartmentIds(data) ?? [];
    await this.validateDepartments(departmentIds);

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { role: true },
    });

    if (!user || user.deletedAt) {
      throw new AppError(
        "Không tìm thấy người dùng",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const userPerms = new Set(
      await permissionCacheService.getUserPermissions(user.id),
    );
    const isEligibleLeader =
      userPerms.has(PERMISSIONS.DAILY_REPORT_FEEDBACK) ||
      userPerms.has(PERMISSIONS.WEEKLY_EVALUATION_CREATE) ||
      userPerms.has(PERMISSIONS.ROLE_READ) ||
      user.role?.name === ROLES.LEADER ||
      user.role?.name === ROLES.ADMIN;

    if (!isEligibleLeader) {
      throw new AppError(
        "Người dùng không có vai trò Leader",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const existing = await this.repository.findByUserId(data.userId);
    if (existing) {
      throw new AppError(
        "Người dùng này đã có hồ sơ leader",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (data.phone) {
      await validatePhoneUniqueness(data.phone);
    }

    const result = await this.repository.create(data, departmentIds);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_LEADER,
      targetType: AUDIT_TARGET_TYPE.LEADER,
      targetId: result.id,
      details: {
        userId: data.userId,
        departmentIds,
        position: data.position,
      },
    });

    if (departmentIds.length > 0) {
      discordBotService.syncLeaderThreads(data.userId).catch((err) => {
        console.warn(`[LeaderService] syncLeaderThreads on create warning:`, err?.message);
      });
    }

    return result;
  }

  async update(
    id: string,
    data: UpdateLeaderDto,
    actorId?: string,
  ): Promise<LeaderDto> {
    const existing = await this.findById(id);

    const departmentIds = this.normalizeDepartmentIds(data);
    let resetPosition = false;

    if (departmentIds !== undefined) {
      await this.validateDepartments(departmentIds);

      // Theo memory.md: Khi cập nhật/thay đổi danh sách Department của Leader,
      // position cũ được reset bỏ nếu không truyền position mới để tránh giữ chức danh không còn phù hợp.
      const currentDeptIds = existing.departments.map((d) => d.id).sort();
      const newDeptIds = [...departmentIds].sort();
      const hasDeptChanged =
        currentDeptIds.length !== newDeptIds.length ||
        currentDeptIds.some((val, idx) => val !== newDeptIds[idx]);

      if (hasDeptChanged && data.position === undefined) {
        resetPosition = true;
      }
    }

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { leaderId: id });
    }

    const result = await this.repository.update(
      id,
      data,
      departmentIds,
      resetPosition,
    );

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_LEADER,
      targetType: AUDIT_TARGET_TYPE.LEADER,
      targetId: id,
      details: {
        departmentIds,
        resetPosition,
        position: resetPosition ? null : data.position,
      },
    });

    if (departmentIds !== undefined) {
      discordBotService.syncLeaderThreads(existing.userId).catch((err) => {
        console.warn(`[LeaderService] syncLeaderThreads on update warning:`, err?.message);
      });
    }

    return result;
  }

  async batchUpdate(
    items: BatchUpdateLeaderItemDto[],
    actorId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<LeaderDto[]> {
    if (items.length === 0) return [];

    const leaderIds = items.map((i) => i.id);
    const existingLeaders = await prisma.leader.findMany({
      where: { id: { in: leaderIds } },
      include: { departments: true, user: true },
    });

    if (existingLeaders.length !== items.length) {
      throw new AppError(
        "Một hoặc nhiều Leader không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const existingMap = new Map(existingLeaders.map((l) => [l.id, l]));

    // Validate no department conflict between items in the same batch
    const deptUsage = new Map<string, string>();
    for (const item of items) {
      if (item.departmentIds) {
        for (const deptId of item.departmentIds) {
          if (deptUsage.has(deptId)) {
            throw new AppError(
              "Không thể phân công cùng một phòng ban cho nhiều Leader trong cùng một lần cập nhật",
              400,
              ERROR_CODE.VALIDATION_ERROR,
            );
          }
          deptUsage.set(deptId, item.id);
        }
      }
    }

    // Validate departments & phone for each item
    for (const item of items) {
      if (item.departmentIds !== undefined) {
        await this.validateDepartments(item.departmentIds);
      }
      if (item.phone) {
        await validatePhoneUniqueness(item.phone, { leaderId: item.id });
      }
    }

    // Determine resetPosition per item
    const itemsWithReset = items.map((item) => {
      const existing = existingMap.get(item.id)!;
      let resetPosition = false;
      if (item.departmentIds !== undefined) {
        const currentDeptIds = existing.departments
          .map((d) => d.departmentId)
          .sort();
        const newDeptIds = [...item.departmentIds].sort();
        const hasDeptChanged =
          currentDeptIds.length !== newDeptIds.length ||
          currentDeptIds.some((val, idx) => val !== newDeptIds[idx]);

        if (hasDeptChanged && item.position === undefined) {
          resetPosition = true;
        }
      }
      return {
        ...item,
        resetPosition,
      };
    });

    const results = await this.repository.batchUpdate(
      itemsWithReset,
      actorId,
      context,
    );

    // Sync Discord threads for leaders whose departments were changed
    for (const item of items) {
      if (item.departmentIds !== undefined) {
        const existing = existingMap.get(item.id);
        if (existing) {
          discordBotService.syncLeaderThreads(existing.userId).catch((err) => {
            console.warn(
              `[LeaderService] syncLeaderThreads on batch update warning:`,
              err?.message,
            );
          });
        }
      }
    }

    return results;
  }

  async getMe(userId: string): Promise<LeaderDto> {
    const leader = await this.repository.findByUserId(userId);
    if (!leader) {
      throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
    }
    return leader;
  }

  async updateMe(
    userId: string,
    data: UpdateMeLeaderDto,
    actorId?: string,
  ): Promise<LeaderDto> {
    const leader = await this.getMe(userId);

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { leaderId: leader.id });
    }

    const result = await this.repository.update(leader.id, data);

    await this.repository.createAuditLog({
      actorId: actorId ?? userId,
      action: AUDIT_ACTION.UPDATE_LEADER,
      targetType: AUDIT_TARGET_TYPE.LEADER,
      targetId: leader.id,
      details: { isSelfUpdate: true },
    });

    return result;
  }

  async delete(id: string, actorId?: string): Promise<LeaderDto> {
    await this.findById(id);
    const result = await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_LEADER,
      targetType: AUDIT_TARGET_TYPE.LEADER,
      targetId: id,
    });

    return result;
  }
}
