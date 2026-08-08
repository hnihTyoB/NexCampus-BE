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
} from "./intern.dto";
import { prisma } from "../../database/prisma.client";
import { StorageService } from "../../common/services/storage.service";
import { storageConfig } from "../../config/storage.config";
import {
  INTERN_STATUS,
  NOTIFICATION_TYPE,
} from "../../common/constants/status.constant";
import { ROLES } from "../../common/constants/role.constant";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";
import { generateSecurePassword } from "../../common/helpers/password.helper";
import { TemplateEmailHelper } from "../../common/helpers/template-email.helper";
import { appConfig } from "../../config/app.config";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

export class InternService {
  private readonly repository = new InternRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: InternQueryDto) {
    await this.repository.completeExpiredInterns();
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    await this.repository.completeExpiredInterns();
    const profile = await this.repository.findById(id);

    if (!profile) {
      throw new AppError("Không tìm thấy thực tập sinh", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async lookupForAssignment(email: string, actorId: string) {
    await this.repository.completeExpiredInterns();
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

  async create(data: CreateInternDto) {
    const existing = await this.repository.findByUserId(data.userId);

    if (existing) {
      throw new AppError(
        "Người dùng này đã có hồ sơ thực tập sinh",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await validatePhoneUniqueness(data.phone);

    return this.repository.create(data);
  }

  async directCreate(data: DirectCreateInternDto, actorId: string) {
    const normalizedEmail = data.email.toLowerCase().trim();

    const [existingUser, role, department, position, leader] =
      await Promise.all([
        prisma.user.findUnique({ where: { email: normalizedEmail } }),
        prisma.role.findUnique({ where: { name: ROLES.INTERN } }),
        prisma.department.findUnique({ where: { id: data.departmentId } }),
        prisma.position.findFirst({
          where: {
            id: data.positionId,
            departmentId: data.departmentId,
          },
        }),
        data.leaderId
          ? prisma.user.findFirst({
              where: {
                id: data.leaderId,
                deletedAt: null,
                isActive: true,
                role: { name: ROLES.LEADER },
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
        "Intern role not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (!department) {
      throw new AppError(
        "Department not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
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

    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const intern = await this.repository.createWithUser(data, {
      email: normalizedEmail,
      passwordHash,
      roleId: role.id,
    });

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_USER,
      `Admin đã tạo trực tiếp tài khoản thực tập sinh ${data.fullName} (${normalizedEmail}).`,
      intern.id,
      "Intern",
    );

    try {
      await TemplateEmailHelper.send(
        normalizedEmail,
        NOTIFICATION_TYPE.USER_CREATED,
        {
          email: normalizedEmail,
          password,
          loginUrl: appConfig.baseUrl,
        },
      );
    } catch (emailError) {
      console.error(
        `[InternService.directCreate] Failed to send registration email to ${normalizedEmail}:`,
        emailError,
      );
    }

    return intern;
  }

  async update(id: string, data: UpdateInternDto) {
    const intern = await this.findById(id);

    if (data.phone) {
      await validatePhoneUniqueness(data.phone, { internId: id });
    }

    // Sync user.isActive with intern status
    if (data.status !== undefined && intern.userId) {
      await prisma.user.update({
        where: { id: intern.userId },
        data: { isActive: data.status !== INTERN_STATUS.DROPPED },
      });
    }

    return this.repository.update(id, data);
  }

  async assignLeader(id: string, leaderId: string | null) {
    await this.findById(id);

    if (leaderId) {
      const leaderUser = await prisma.user.findUnique({
        where: { id: leaderId },
        include: { role: true },
      });

      if (!leaderUser) {
        throw new AppError("Không tìm thấy Leader", 404, ERROR_CODE.NOT_FOUND);
      }

      if (leaderUser.role.name !== "LEADER") {
        throw new AppError(
          "Người dùng được chọn không phải là LEADER",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    return this.repository.update(id, { leaderId });
  }

  async delete(id: string) {
    const profile = await this.findById(id);
    if (!profile) {
      throw new AppError("Không tìm thấy hồ sơ thực tập sinh", 404, ERROR_CODE.NOT_FOUND);
    }

    const email = profile.user.email;

    // 1. Tìm đơn ứng tuyển có cùng email đã được duyệt (APPROVED)
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
              `[InternService.delete] Failed to delete R2 object ${attachment.filePath}:`,
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

    return this.repository.softDelete(id);
  }

  async getMe(userId: string) {
    const profile = await this.repository.findByUserId(userId);

    if (!profile) {
      throw new AppError("Không tìm thấy hồ sơ thực tập sinh", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async updateMe(userId: string, data: UpdateMeInternDto) {
    const profile = await this.getMe(userId);

    return this.update(profile.id, data);
  }
}
