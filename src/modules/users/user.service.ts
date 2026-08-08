import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRepository } from "./user.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { UserQueryDto, CreateUserDto, UpdateUserDto } from "./user.dto";
import { prisma } from "../../database/prisma.client";
import { StorageService } from "../../common/services/storage.service";
import { appConfig } from "../../config/app.config";
import { storageConfig } from "../../config/storage.config";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { EmailService } from "../../common/services/email.service";
import { TemplateEmailHelper } from "../../common/helpers/template-email.helper";
import { NOTIFICATION_TYPE } from "../../common/constants/status.constant";
import { generateSecurePassword } from "../../common/helpers/password.helper";

export class UserService {
  private readonly repository = new UserRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: UserQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return user;
  }

  async create(data: CreateUserDto, actorId: string) {
    const existing = await this.repository.findByEmail(data.email);

    if (existing) {
      throw new AppError(
        "Email already exists",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    let roleId = data.roleId;
    if (!roleId && data.roleName) {
      const role = await this.repository.findRoleByName(data.roleName);
      if (!role) {
        throw new AppError("Role not found", 404, ERROR_CODE.NOT_FOUND);
      }
      roleId = role.id;
    }

    if (!roleId) {
      throw new AppError(
        "Role is required",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const password = data.password || generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await this.repository.create({
      email: data.email,
      passwordHash,
      roleId,
    });

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_USER,
      `Admin đã tạo tài khoản mới: ${result.email}`,
      result.id,
      "User",
    );

    try {
      await TemplateEmailHelper.send(
        data.email,
        NOTIFICATION_TYPE.USER_CREATED,
        { email: data.email, password, loginUrl: appConfig.baseUrl }
      );
    } catch (emailError) {
      console.error(`[UserService] Failed to send registration email to ${data.email}:`, emailError);
    }

    return result;
  }

  async update(id: string, data: UpdateUserDto, actorId: string) {
    const targetUser = await this.findById(id);

    const result = await this.repository.update(id, {
      isActive: data.isActive,
      roleId: data.roleId,
    });

    const changes: string[] = [];
    if (data.isActive !== undefined && data.isActive !== targetUser.isActive) {
      changes.push(data.isActive ? "kích hoạt tài khoản" : "khóa tài khoản");
    }
    if (data.roleId !== undefined && data.roleId !== targetUser.roleId) {
      changes.push("thay đổi vai trò");
    }

    if (changes.length > 0) {
      await this.activityLogService.log(
        actorId,
        ACTIVITY_ACTIONS.UPDATE_USER,
        `Admin đã cập nhật tài khoản ${result.fullName || result.email}: ${changes.join(", ")}`,
        result.id,
        "User",
      );
    }

    return result;
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    const user = await this.findById(id);

    const bucket = storageConfig.namespaces.avatars;
    const storageService = new StorageService();
    const oldAvatarPath = user.avatarUrl
      ? storageService.getPathFromPublicUrl(bucket, user.avatarUrl)
      : null;

    // 1. Upload the replacement before changing the database or old object.
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/${crypto.randomUUID()}_${safeFileName}`;
    const avatarUrl = await storageService.uploadFile(
      bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 2. Update the database, rolling back the new object on failure.
    let updatedUser;
    try {
      updatedUser = await this.repository.update(id, { avatarUrl });
    } catch (error) {
      await storageService.deleteFile(bucket, filePath).catch((cleanupError) => {
        console.error(`[UserService] Failed to roll back R2 avatar ${filePath}:`, cleanupError);
      });
      throw error;
    }

    // 3. The old URL may belong to the legacy provider or be external.
    if (oldAvatarPath) {
      await storageService.deleteFile(bucket, oldAvatarPath).catch((error) => {
        console.error(`[UserService] Failed to delete old R2 avatar ${oldAvatarPath}:`, error);
      });
    }

    return updatedUser;
  }

  async delete(id: string, actorId: string) {
    if (id === actorId) {
      throw new AppError(
        "You cannot delete your own admin account",
        400,
        ERROR_CODE.BAD_REQUEST,
      );
    }

    const targetUser = await this.findById(id);

    // 1. Tìm đơn ứng tuyển có cùng email đã được duyệt (APPROVED)
    const email = targetUser.email;
    const application = await prisma.application.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: "APPROVED",
        deletedAt: null,
      },
    });

    if (application) {
      // 2. Tìm tất cả tệp đính kèm của đơn ứng tuyển này
      const attachments = await prisma.applicationAttachment.findMany({
        where: { applicationId: application.id },
      });

      if (attachments.length > 0) {
        const storageService = new StorageService();
        const bucket = storageConfig.namespaces.applications;

        // 3. Delete these files from Cloudflare R2.
        for (const attachment of attachments) {
          try {
            await storageService.deleteFile(bucket, attachment.filePath);
          } catch (storageError) {
            console.error(
              `[UserService.delete] Failed to delete R2 object ${attachment.filePath}:`,
              storageError,
            );
          }
        }

        // 4. Xóa các bản ghi đính kèm trong database
        await prisma.applicationAttachment.deleteMany({
          where: { applicationId: application.id },
        });
      }
    }

    const result = await this.repository.delete(id, actorId);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_USER,
      `Admin đã xóa tài khoản ${targetUser.fullName || targetUser.email}`,
      id,
      "User",
    );

    return result;
  }
}
