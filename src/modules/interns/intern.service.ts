import crypto from "crypto";
import bcrypt from "bcryptjs";
import { InternRepository } from "./intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  InternQueryDto,
  CreateInternDto,
  DirectCreateInternDto,
  UpdateInternDto,
  UpdateMeInternDto,
  BatchUpdateInternItemDto,
  InternDto,
} from "./intern.dto";
import { prisma } from "../../database/prisma.client";
import { INTERN_STATUS } from "../../common/constants/intern.constant";
import { ROLES } from "../../common/constants/role.constant";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { systemConfigService } from "../system-config/system-config.service";
import { HRM_CONFIG_KEYS } from "../../common/constants/system-config.constant";
import { discordBotService } from "../../common/services/discord-bot.service";
import { discordWebhookManageService } from "../integration/discord-webhook.service";

export class InternService {
  private readonly repository = new InternRepository();

  private async handleLazyAutoComplete(): Promise<void> {
    const isEnabled = await systemConfigService.isFeatureEnabled(
      HRM_CONFIG_KEYS.AUTO_COMPLETE_EXPIRED_INTERNS,
      true,
    );
    if (isEnabled) {
      await this.repository.completeExpiredInterns();
    }
  }

  async findAll(
    query: InternQueryDto,
    user?: { id: string; role?: string },
  ): Promise<{
    data: InternDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    await this.handleLazyAutoComplete();

    if (user) {
      const callerPerms = new Set(
        await permissionCacheService.getUserPermissions(user.id),
      );
      const hasGlobalAccess =
        callerPerms.has(PERMISSIONS.INTERN_DELETE) ||
        callerPerms.has(PERMISSIONS.ROLE_READ) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

      if (!hasGlobalAccess) {
        const leaderRecord = await prisma.leader.findFirst({
          where: { userId: user.id },
          select: {
            departments: { select: { departmentId: true } },
          },
        });

        if (leaderRecord) {
          const departmentIds =
            leaderRecord.departments.map((d) => d.departmentId) ?? [];

          return this.repository.findAll(query, {
            departmentIds,
            leaderUserId: user.id,
          });
        }
      }
    }

    return this.repository.findAll(query);
  }

  async findById(
    id: string,
    user?: { id: string; role?: string },
  ): Promise<InternDto> {
    await this.handleLazyAutoComplete();
    const profile = await this.repository.findById(id);

    if (!profile) {
      throw new AppError(
        "Không tìm thấy thực tập sinh",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (user) {
      const callerPerms = new Set(
        await permissionCacheService.getUserPermissions(user.id),
      );
      const hasGlobalAccess =
        callerPerms.has(PERMISSIONS.INTERN_DELETE) ||
        callerPerms.has(PERMISSIONS.ROLE_READ) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

      if (!hasGlobalAccess) {
        const leaderRecord = await prisma.leader.findFirst({
          where: { userId: user.id },
          select: {
            departments: { select: { departmentId: true } },
          },
        });

        if (leaderRecord) {
          const leaderDeptIds =
            leaderRecord.departments.map((d) => d.departmentId) ?? [];

          const inLeaderDept =
            profile.departmentId && leaderDeptIds.includes(profile.departmentId);
          const isDirectLeader = profile.leaderId === user.id;

          if (!inLeaderDept && !isDirectLeader) {
            throw new AppError(
              "Forbidden: Bạn không có quyền truy cập thông tin thực tập sinh này",
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
        }
      }
    }

    return profile;
  }

  async lookupForAssignment(email: string, actorId: string) {
    await this.handleLazyAutoComplete();
    const intern = await this.repository.findActiveByEmail(
      email.toLowerCase().trim(),
    );

    if (!intern || !intern.leader || intern.leaderId === actorId) {
      throw new AppError(
        "Không tìm thấy thực tập sinh active thuộc team khác với email này",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return {
      id: intern.id,
      fullName: intern.fullName,
      email: intern.user.email,
      leader: intern.leader,
    };
  }

  async create(data: CreateInternDto, actorId?: string): Promise<InternDto> {
    const existing = await this.repository.findByUserId(data.userId);
    if (existing) {
      throw new AppError(
        "Người dùng này đã có hồ sơ thực tập sinh",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const [department, position] = await Promise.all([
      prisma.department.findFirst({
        where: { id: data.departmentId, deletedAt: null },
      }),
      prisma.position.findFirst({
        where: {
          id: data.positionId,
          departmentId: data.departmentId,
          deletedAt: null,
        },
      }),
    ]);

    if (!department) {
      throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!position) {
      throw new AppError(
        "Position does not belong to the selected department",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (data.leaderId) {
      const leader = await prisma.user.findFirst({
        where: {
          id: data.leaderId,
          deletedAt: null,
          isActive: true,
        },
      });
      if (!leader) {
        throw new AppError(
          "Active leader not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    await validatePhoneUniqueness(data.phone);

    const [prefix, defaultDuration] = await Promise.all([
      systemConfigService.get<string>(
        HRM_CONFIG_KEYS.INTERN_CODE_PREFIX,
        "INT",
      ),
      systemConfigService.get<number>(
        HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS,
        3,
      ),
    ]);

    const intern = await this.repository.create(
      data,
      prefix,
      defaultDuration,
    );

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_INTERN,
      targetType: AUDIT_TARGET_TYPE.INTERN,
      targetId: intern.id,
      details: {
        fullName: intern.fullName,
        departmentId: intern.departmentId,
        internCode: intern.internCode,
      },
    });

    // Zero-Touch Discord Member Sync
    const discordId =
      intern.discordUserId ||
      (intern.discordUsername && /^\d{17,20}$/.test(intern.discordUsername)
        ? intern.discordUsername
        : null);
    if (discordId && intern.departmentId) {
      discordBotService
        .syncInternMember({
          internId: intern.id,
          discordUserId: discordId,
          departmentId: intern.departmentId,
        })
        .catch((err) => {
          console.warn(
            `[InternService] Discord sync for ${intern.fullName} failed:`,
            err?.message,
          );
        });
    }

    return intern;
  }

  async directCreate(
    data: DirectCreateInternDto,
    actorId?: string,
  ): Promise<InternDto & { generatedPassword?: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const [existingUser, role, department, position, leader] =
      await Promise.all([
        prisma.user.findUnique({ where: { email: normalizedEmail } }),
        prisma.role.findFirst({
          where: { name: { in: [ROLES.INTERN, "USER"] } },
          orderBy: { name: "asc" },
        }),
        prisma.department.findFirst({
          where: { id: data.departmentId, deletedAt: null },
        }),
        prisma.position.findFirst({
          where: {
            id: data.positionId,
            departmentId: data.departmentId,
            deletedAt: null,
          },
        }),
        data.leaderId
          ? prisma.user.findFirst({
              where: {
                id: data.leaderId,
                deletedAt: null,
                isActive: true,
              },
            })
          : Promise.resolve(null),
      ]);

    if (existingUser) {
      throw new AppError(
        "Email already exists",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (!role) {
      throw new AppError(
        "Role for intern not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (!department) {
      throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!position) {
      throw new AppError(
        "Position does not belong to the selected department",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (data.leaderId && !leader) {
      throw new AppError(
        "Active leader not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    await validatePhoneUniqueness(data.phone);

    // Generate secure 12-char random password
    const rawPassword =
      "Nx@" + crypto.randomBytes(6).toString("hex") + "!";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const [prefix, defaultDuration] = await Promise.all([
      systemConfigService.get<string>(
        HRM_CONFIG_KEYS.INTERN_CODE_PREFIX,
        "INT",
      ),
      systemConfigService.get<number>(
        HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS,
        3,
      ),
    ]);

    const intern = await this.repository.createWithUser(
      data,
      {
        email: normalizedEmail,
        passwordHash,
        roleId: role.id,
      },
      prefix,
      defaultDuration,
    );

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_INTERN,
      targetType: AUDIT_TARGET_TYPE.INTERN,
      targetId: intern.id,
      details: {
        fullName: intern.fullName,
        email: normalizedEmail,
        internCode: intern.internCode,
      },
    });

    // Zero-Touch Discord Member Sync
    const discordId =
      intern.discordUserId ||
      (intern.discordUsername && /^\d{17,20}$/.test(intern.discordUsername)
        ? intern.discordUsername
        : null);
    if (discordId && intern.departmentId) {
      discordBotService
        .syncInternMember({
          internId: intern.id,
          discordUserId: discordId,
          departmentId: intern.departmentId,
        })
        .catch((err) => {
          console.warn(
            `[InternService] Discord sync for ${intern.fullName} failed:`,
            err?.message,
          );
        });
    }

    return {
      ...intern,
      generatedPassword: rawPassword,
    };
  }

  async update(
    id: string,
    data: UpdateInternDto,
    actorId?: string,
  ): Promise<InternDto> {
    const intern = await this.findById(id);

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { internId: id });
    }

    if (data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, deletedAt: null },
      });
      if (!dept) {
        throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
      }
    }

    if (data.positionId) {
      const deptId = data.departmentId || intern.departmentId;
      if (deptId) {
        const pos = await prisma.position.findFirst({
          where: {
            id: data.positionId,
            departmentId: deptId,
            deletedAt: null,
          },
        });
        if (!pos) {
          throw new AppError(
            "Position does not belong to the selected department",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
      }
    }

    if (data.leaderId) {
      const leader = await prisma.user.findFirst({
        where: { id: data.leaderId, deletedAt: null, isActive: true },
      });
      if (!leader) {
        throw new AppError(
          "Active leader not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    // Sync user.isActive with intern status
    if (data.status !== undefined && intern.userId) {
      await prisma.user.update({
        where: { id: intern.userId },
        data: { isActive: data.status !== INTERN_STATUS.DROPPED },
      });
    }

    const updated = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_INTERN,
      targetType: AUDIT_TARGET_TYPE.INTERN,
      targetId: id,
      details: {
        updatedFields: Object.keys(data),
      },
    });

    // Zero-Touch Discord Member Sync
    const oldDeptId = intern.departmentId;
    const newDeptId = updated.departmentId;
    const isCompletedOrDropped =
      data.status === INTERN_STATUS.COMPLETED ||
      data.status === INTERN_STATUS.DROPPED;
    const currentDiscordId =
      updated.discordUserId ||
      (updated.discordUsername && /^\d{17,20}$/.test(updated.discordUsername)
        ? updated.discordUsername
        : null);

    if (currentDiscordId) {
      if (isCompletedOrDropped) {
        discordBotService
          .syncInternMember({
            internId: id,
            discordUserId: currentDiscordId,
            departmentId: null,
            oldDepartmentId: oldDeptId,
          })
          .catch((err) => {
            console.warn(
              `[InternService] Discord de-sync on status change failed:`,
              err?.message,
            );
          });
      } else if (
        (newDeptId && newDeptId !== oldDeptId) ||
        data.discordUserId ||
        (data.discordUsername && !updated.discordRoleGranted)
      ) {
        discordBotService
          .syncInternMember({
            internId: id,
            discordUserId: currentDiscordId,
            departmentId: newDeptId,
            oldDepartmentId: oldDeptId !== newDeptId ? oldDeptId : null,
          })
          .catch((err) => {
            console.warn(
              `[InternService] Discord sync on update failed:`,
              err?.message,
            );
          });
      }
    }

    if (
      updated.userId &&
      (data.discordUserId !== undefined || data.discordUsername !== undefined)
    ) {
      const cleanDiscordId = data.discordUserId?.trim();
      const validDiscordId =
        cleanDiscordId && /^\d{17,20}$/.test(cleanDiscordId) ? cleanDiscordId : null;

      await this.repository.syncUserDiscord(updated.userId, {
        ...(data.discordUserId !== undefined
          ? { discordUserId: validDiscordId }
          : {}),
        ...(data.discordUsername !== undefined
          ? { discordUsername: data.discordUsername?.trim() || null }
          : {}),
      });
    }

    return updated;
  }

  async batchUpdate(
    items: BatchUpdateInternItemDto[],
    actorId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<InternDto[]> {
    if (items.length === 0) return [];

    // Verify all interns exist
    const internIds = items.map((i) => i.id);
    const existingInterns = await prisma.intern.findMany({
      where: { id: { in: internIds }, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        positionId: true,
        leaderId: true,
        userId: true,
        fullName: true,
      },
    });

    if (existingInterns.length !== items.length) {
      throw new AppError(
        "Một hoặc nhiều thực tập sinh không tồn tại hoặc đã bị xóa",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const existingMap = new Map(existingInterns.map((i) => [i.id, i]));

    // Determine effective items with position reset if department changed
    const itemsWithEffectivePosition = items.map((item) => {
      const existing = existingMap.get(item.id)!;
      let effectivePositionId = item.positionId;

      if (item.departmentId !== undefined && item.positionId === undefined) {
        if (
          item.departmentId === null ||
          item.departmentId !== existing.departmentId
        ) {
          effectivePositionId = null;
        }
      }

      return {
        ...item,
        positionId: effectivePositionId,
      };
    });

    // Validate department existence
    const deptIds = [
      ...new Set(
        itemsWithEffectivePosition
          .map((i) => i.departmentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (deptIds.length > 0) {
      const depts = await prisma.department.findMany({
        where: { id: { in: deptIds }, deletedAt: null },
        select: { id: true },
      });
      if (depts.length !== deptIds.length) {
        throw new AppError(
          "Một hoặc nhiều phòng ban không tồn tại hoặc đã bị xóa",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    // Validate position belongs to department
    for (const item of itemsWithEffectivePosition) {
      if (item.positionId) {
        const existing = existingMap.get(item.id);
        const deptId =
          item.departmentId !== undefined
            ? item.departmentId
            : existing?.departmentId;
        if (!deptId) {
          throw new AppError(
            `Thực tập sinh ${existing?.fullName || item.id} chưa có phòng ban để gán vị trí`,
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
        const pos = await prisma.position.findFirst({
          where: {
            id: item.positionId,
            departmentId: deptId,
            deletedAt: null,
          },
        });
        if (!pos) {
          throw new AppError(
            `Vị trí không thuộc phòng ban được chọn cho thực tập sinh ${existing?.fullName || item.id}`,
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
      }
    }

    // Validate leaders
    const leaderIds = [
      ...new Set(
        itemsWithEffectivePosition
          .map((i) => i.leaderId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (leaderIds.length > 0) {
      const leaders = await prisma.user.findMany({
        where: { id: { in: leaderIds }, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (leaders.length !== leaderIds.length) {
        throw new AppError(
          "Một hoặc nhiều Leader không tồn tại hoặc không còn hoạt động",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    const results = await this.repository.batchUpdate(
      itemsWithEffectivePosition,
      actorId,
      context,
    );

    // Discord sync in background
    for (const updated of results) {
      const currentDiscordId =
        updated.discordUserId ||
        (updated.discordUsername && /^\d{17,20}$/.test(updated.discordUsername)
          ? updated.discordUsername
          : null);
      if (currentDiscordId) {
        const item = items.find((i) => i.id === updated.id);
        const isCompletedOrDropped =
          item?.status === INTERN_STATUS.COMPLETED ||
          item?.status === INTERN_STATUS.DROPPED;
        if (isCompletedOrDropped) {
          discordBotService
            .syncInternMember({
              internId: updated.id,
              discordUserId: currentDiscordId,
              departmentId: null,
            })
            .catch(() => {});
        } else if (item?.departmentId !== undefined) {
          discordBotService
            .syncInternMember({
              internId: updated.id,
              discordUserId: currentDiscordId,
              departmentId: updated.departmentId,
            })
            .catch(() => {});
        }
      }
    }

    return results;
  }

  async assignLeader(
    id: string,
    leaderId: string | null,
    actorId?: string,
  ): Promise<InternDto> {
    await this.findById(id);

    if (leaderId) {
      const leaderUser = await prisma.user.findFirst({
        where: { id: leaderId, deletedAt: null, isActive: true },
        include: { role: true },
      });

      if (!leaderUser) {
        throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
      }

      const leaderRecord = await prisma.leader.findFirst({
        where: { userId: leaderUser.id },
      });
      const leaderPerms = new Set(
        await permissionCacheService.getUserPermissions(leaderUser.id),
      );
      const isEligibleLeader =
        !!leaderRecord ||
        leaderPerms.has(PERMISSIONS.DAILY_REPORT_FEEDBACK) ||
        leaderPerms.has(PERMISSIONS.WEEKLY_EVALUATION_CREATE) ||
        leaderPerms.has(PERMISSIONS.ROLE_READ) ||
        leaderUser.role?.name === ROLES.LEADER ||
        leaderUser.role?.name === ROLES.ADMIN;

      if (!isEligibleLeader) {
        throw new AppError(
          "Người dùng được chọn không có vai trò Leader",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    const result = await this.repository.update(id, { leaderId });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.ASSIGN_LEADER,
      targetType: AUDIT_TARGET_TYPE.INTERN,
      targetId: id,
      details: { leaderId },
    });

    return result;
  }

  async delete(id: string, actorId?: string): Promise<InternDto> {
    const intern = await this.findById(id);

    const result = await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_INTERN,
      targetType: AUDIT_TARGET_TYPE.INTERN,
      targetId: id,
    });

    // Zero-Touch Discord De-sync
    const discordId =
      intern.discordUserId ||
      (intern.discordUsername && /^\d{17,20}$/.test(intern.discordUsername)
        ? intern.discordUsername
        : null);
    if (discordId && intern.departmentId) {
      discordBotService
        .syncInternMember({
          internId: id,
          discordUserId: discordId,
          departmentId: null,
          oldDepartmentId: intern.departmentId,
        })
        .catch((err) => {
          console.warn(
            `[InternService] Discord de-sync on delete failed:`,
            err?.message,
          );
        });
    }

    return result;
  }

  async getMe(userId: string): Promise<InternDto> {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) {
      throw new AppError(
        "Không tìm thấy hồ sơ thực tập sinh",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    return profile;
  }

  async updateMe(
    userId: string,
    data: UpdateMeInternDto,
    actorId?: string,
  ): Promise<InternDto> {
    const profile = await this.getMe(userId);
    return this.update(profile.id, data, actorId);
  }

  async sendDiscordReminder(
    internId: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    return discordWebhookManageService.remindInternDiscord(internId, {
      actorId,
      ipAddress,
      userAgent,
    });
  }

  async sendBatchDiscordReminders(
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ totalEligible: number; sentCount: number }> {
    return discordWebhookManageService.remindUnlinkedDiscord({
      actorId,
      ipAddress,
      userAgent,
    });
  }
}
