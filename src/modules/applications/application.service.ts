import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ApplicationRepository } from "./application.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  ApplicationQueryDto,
  GetApplicationInvitesQuery,
  CreateInviteDto,
  CreateApplicationDto,
  AssignApplicationDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  ReviewApplicationDto,
  ApplicationDto,
  ApplicationInviteDto,
} from "./application.dto";
import {
  APPLICATION_STATUS,
  APPLICATION_INVITE_STATUS,
} from "../../common/constants/application.constant";
import { prisma } from "../../database/prisma.client";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";
import { ROLES } from "../../common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { systemConfigService } from "../system-config/system-config.service";
import { HRM_CONFIG_KEYS } from "../../common/constants/system-config.constant";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  NOTIFICATION_CHANNEL,
  EMAIL_TEMPLATE_KEY,
} from "../../common/constants/notification.constant";
import { dispatchEmailJob } from "../../queues";
import { R2Service } from "../../common/services/r2.service";
import { envConfig } from "../../config/env.config";

export class ApplicationService {
  private readonly repository = new ApplicationRepository();
  private readonly r2Service = new R2Service();

  // ─── Application Invites ──────────────────────────────────────────────────

  async createInvite(
    actorId: string,
    data: CreateInviteDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ invite: ApplicationInviteDto; link: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const activeInvite =
      await this.repository.findActiveInviteByEmail(normalizedEmail);
    if (activeInvite) {
      throw new AppError(
        "An active invitation already exists for this email",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    // Default invitation validity: 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.repository.createInvite({
      email: normalizedEmail,
      token,
      expiresAt,
      createdBy: actorId,
    });

    const baseUrl =
      envConfig.appUrl ||
      envConfig.cors.allowedOrigins[0] ||
      "http://localhost:3000";
    const applyUrl = `${baseUrl.replace(/\/$/, "")}/onboarding/${token}`;

    // Enqueue invitation email to BullMQ emailQueue
    await dispatchEmailJob({
      type: "INVITE_APPLICATION",
      to: normalizedEmail,
      data: {
        candidateEmail: normalizedEmail,
        applyUrl,
        expiresAt: expiresAt.toISOString(),
      },
    }).catch((err) => {
      console.warn(
        `[ApplicationService] Failed to dispatch invitation email to ${normalizedEmail}:`,
        err.message,
      );
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_APPLICATION_INVITE,
      targetType: AUDIT_TARGET_TYPE.APPLICATION_INVITE,
      targetId: invite.id,
      details: { email: normalizedEmail, token, expiresAt: expiresAt.toISOString() },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      invite,
      link: applyUrl,
    };
  }

  async verifyInvite(token: string): Promise<{ valid: boolean; email: string }> {
    const invite = await this.repository.findInviteByToken(token);

    if (!invite) {
      throw new AppError(
        "Invalid invitation token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (invite.status === APPLICATION_INVITE_STATUS.REVOKED) {
      throw new AppError(
        "This invitation link has been revoked",
        400,
        ERROR_CODE.TOKEN_REVOKED,
      );
    }

    if (invite.status === APPLICATION_INVITE_STATUS.USED) {
      throw new AppError(
        "This invitation link has already been used",
        400,
        ERROR_CODE.TOKEN_USED,
      );
    }

    if (
      invite.status === APPLICATION_INVITE_STATUS.EXPIRED ||
      invite.expiresAt < new Date()
    ) {
      await this.repository.markInviteExpired(token);
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    return {
      valid: true,
      email: invite.email,
    };
  }

  findAllInvites(query: GetApplicationInvitesQuery) {
    return this.repository.findInvites(query);
  }

  async findInviteById(id: string): Promise<ApplicationInviteDto> {
    const invite = await this.repository.findInviteById(id);
    if (!invite) {
      throw new AppError("Invitation not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return invite;
  }

  async revokeInvite(
    actorId: string,
    id: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationInviteDto> {
    const invite = await this.findInviteById(id);

    if (invite.status === APPLICATION_INVITE_STATUS.USED) {
      throw new AppError(
        "Cannot revoke an invitation that has already been used",
        400,
        ERROR_CODE.TOKEN_USED,
      );
    }

    const updated = await this.repository.revokeInvite(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.REVOKE_APPLICATION_INVITE,
      targetType: AUDIT_TARGET_TYPE.APPLICATION_INVITE,
      targetId: id,
      details: { email: invite.email },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  }

  // ─── Applications (Candidate Submission) ──────────────────────────────────

  async submitApplication(
    data: CreateApplicationDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationDto> {
    // 1. Verify invitation token
    const invite = await this.repository.findInviteByToken(data.token);

    if (!invite) {
      throw new AppError(
        "Invalid invitation token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (invite.status === APPLICATION_INVITE_STATUS.REVOKED) {
      throw new AppError(
        "This invitation link has been revoked",
        400,
        ERROR_CODE.TOKEN_REVOKED,
      );
    }

    if (invite.status === APPLICATION_INVITE_STATUS.USED) {
      throw new AppError(
        "This invitation link has already been used",
        400,
        ERROR_CODE.TOKEN_USED,
      );
    }

    if (
      invite.status === APPLICATION_INVITE_STATUS.EXPIRED ||
      invite.expiresAt < new Date()
    ) {
      await this.repository.markInviteExpired(data.token);
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    // 2. Email matching security check
    const normalizedEmail = data.email.toLowerCase().trim();
    if (normalizedEmail !== invite.email.toLowerCase().trim()) {
      throw new AppError(
        "Email does not match the invitation email",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. User & Application collision checks
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new AppError(
        "A user with this email already exists in the system",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const existingApp =
      await this.repository.findPendingOrApprovedByEmail(normalizedEmail);
    if (existingApp) {
      throw new AppError(
        "An application with this email already exists and is pending or approved",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const existingPhoneApp =
      await this.repository.findPendingOrApprovedByPhone(data.phone);
    if (existingPhoneApp) {
      throw new AppError(
        "This phone number is already in use in another active application",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await validatePhoneUniqueness(data.phone);

    // 4. Verify regulation if specified
    if (data.regulationId) {
      const reg = await prisma.regulation.findFirst({
        where: { id: data.regulationId, isActive: true },
      });
      if (!reg) {
        throw new AppError(
          "Invalid or inactive regulation ID",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // 5. Dynamic fallback duration
    const defaultDuration = await systemConfigService.get<number>(
      HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS,
      3,
    );
    const duration = data.duration ?? defaultDuration;

    // 6. Create application in transaction & mark invite as USED
    const application = await this.repository.createWithInvite(data, duration);

    try {
      await this.repository.createAuditLog({
        action: AUDIT_ACTION.CREATE_APPLICATION,
        targetType: AUDIT_TARGET_TYPE.APPLICATION,
        targetId: application.id,
        details: {
          fullName: application.fullName,
          email: application.email,
          phone: application.phone,
          preferredDepartment: application.preferredDepartment,
          preferredPosition: application.preferredPosition,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    } catch (auditErr: any) {
      console.warn(
        `[ApplicationService] Failed to create audit log for application ${application.id}:`,
        auditErr.message,
      );
    }

    return application;
  }

  // ─── Applications Management (Admin Workflow) ─────────────────────────────

  findAll(query: ApplicationQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string): Promise<ApplicationDto> {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError("Application not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return application;
  }

  async assign(
    actorId: string,
    id: string,
    data: AssignApplicationDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationDto> {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        "Only pending applications can be assigned",
        409,
        ERROR_CODE.CONFLICT,
      );
    }

    if (data.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: data.departmentId, deletedAt: null },
      });
      if (!department) {
        throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
      }
    }

    if (data.positionId) {
      if (!data.departmentId) {
        throw new AppError(
          "A department is required before assigning a position",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      const position = await prisma.position.findFirst({
        where: {
          id: data.positionId,
          departmentId: data.departmentId,
          deletedAt: null,
        },
      });
      if (!position) {
        throw new AppError(
          "Position does not belong to the selected department",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    const updated = await this.repository.assign(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.ASSIGN_APPLICATION,
      targetType: AUDIT_TARGET_TYPE.APPLICATION,
      targetId: id,
      details: {
        departmentId: data.departmentId,
        positionId: data.positionId,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  }

  async approve(
    actorId: string,
    id: string,
    data?: ApproveApplicationDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationDto & { generatedPassword?: string }> {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        `Đơn đăng ký đã ở trạng thái ${application.status.toLowerCase()}`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (!application.departmentId || !application.positionId) {
      throw new AppError(
        "Assign a department and position before approving this application",
        409,
        ERROR_CODE.CONFLICT,
      );
    }

    const normalizedEmail = application.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new AppError(
        "Người dùng với email này đã tồn tại trên hệ thống",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await validatePhoneUniqueness(application.phone);

    const role = await prisma.role.findUnique({
      where: { name: ROLES.INTERN },
    });
    if (!role) {
      throw new AppError(
        "Vai trò thực tập sinh không tồn tại trong hệ thống",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    // Verify leader if provided
    if (data?.leaderId) {
      const leader = await prisma.user.findFirst({
        where: { id: data.leaderId, isActive: true, deletedAt: null },
      });
      if (!leader) {
        throw new AppError("Active leader not found", 404, ERROR_CODE.NOT_FOUND);
      }
    }

    const rawPassword =
      "Nx@" + crypto.randomBytes(6).toString("hex") + "!";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const internCodePrefix = await systemConfigService.get<string>(
      HRM_CONFIG_KEYS.INTERN_CODE_PREFIX,
      "INT",
    );

    const { application: approvedApp, user } =
      await this.repository.approveWithAccount(
        id,
        actorId,
        {
          email: normalizedEmail,
          passwordHash,
          fullName: application.fullName,
          roleId: role.id,
        },
        {
          phone: application.phone,
          departmentId: application.departmentId,
          positionId: application.positionId,
          startDate: application.startDate,
          duration: application.duration,
          leaderId: data?.leaderId,
          university: application.university,
          major: application.major,
          internCodePrefix,
        },
      );

    // Enqueue approval and welcome email to BullMQ emailQueue
    const loginUrl =
      envConfig.appUrl ||
      envConfig.cors.allowedOrigins[0] ||
      "http://localhost:3000";
    await dispatchEmailJob(
      {
        type: "INTERN_ACCOUNT_CREATED",
        to: normalizedEmail,
        data: {
          fullName: application.fullName,
          email: normalizedEmail,
          temporaryPassword: rawPassword,
          loginUrl,
          departmentName: (application as any).department?.name,
          positionTitle: (application as any).position?.title,
          startDate: application.startDate
            ? new Date(application.startDate).toLocaleDateString("vi-VN")
            : undefined,
        },
      },
      {
        removeOnFail: true,
        removeOnComplete: true,
      },
    ).catch((err) => {
      console.warn(
        `[ApplicationService] Failed to dispatch approval email to ${normalizedEmail}:`,
        err.message,
      );
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.APPROVE_APPLICATION,
      targetType: AUDIT_TARGET_TYPE.APPLICATION,
      targetId: id,
      details: {
        userId: user.id,
        fullName: application.fullName,
        departmentId: application.departmentId,
        positionId: application.positionId,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      ...approvedApp,
      generatedPassword: rawPassword,
    };
  }

  async reject(
    actorId: string,
    id: string,
    data: RejectApplicationDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationDto> {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        `Đơn đăng ký đã ở trạng thái ${application.status.toLowerCase()}`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const rejectedApp = await this.repository.reject(
      id,
      actorId,
      data.rejectedReason,
    );

    // Enqueue rejection email
    await notificationDispatcher
      .send({
        channels: [NOTIFICATION_CHANNEL.EMAIL],
        userId: actorId,
        email: {
          toEmail: application.email,
          templateKey: EMAIL_TEMPLATE_KEY.APPLICATION_REJECTED,
          templateData: {
            fullName: application.fullName,
            reason: data.rejectedReason,
          },
        },
      })
      .catch((err) => {
        console.warn(
          `[ApplicationService] Failed to send rejection email to ${application.email}:`,
          err.message,
        );
      });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.REJECT_APPLICATION,
      targetType: AUDIT_TARGET_TYPE.APPLICATION,
      targetId: id,
      details: {
        fullName: application.fullName,
        email: application.email,
        rejectedReason: data.rejectedReason,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return rejectedApp;
  }

  async review(
    actorId: string,
    id: string,
    dto: ReviewApplicationDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ApplicationDto & { generatedPassword?: string }> {
    if (dto.status === APPLICATION_STATUS.APPROVED) {
      return this.approve(actorId, id, { leaderId: dto.leaderId }, context);
    }
    return this.reject(
      actorId,
      id,
      { rejectedReason: dto.rejectedReason || "Application not accepted" },
      context,
    );
  }

  async delete(
    actorId: string,
    id: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const application = await this.findById(id);

    await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_APPLICATION,
      targetType: AUDIT_TARGET_TYPE.APPLICATION,
      targetId: id,
      details: { fullName: application.fullName, email: application.email },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  getStats() {
    return this.repository.getStats();
  }

  // ─── Cloudflare R2 Uploads ────────────────────────────────────────────────

  async getAttachmentUploadUrl(
    token: string,
    fileName: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // SEC-05: Xác thực invitation token hợp lệ trước khi cấp presigned URL
    await this.verifyInvite(token);

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `applications/${crypto.randomUUID()}_${safeFileName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      key,
      contentType,
    );
    const publicUrl = this.r2Service.getPublicUrl(key);

    return { uploadUrl, key, publicUrl };
  }
}
