import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ApplicationRepository } from "./application.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  ApplicationQueryDto,
  CreateApplicationDto,
  ReviewApplicationDto,
  CreateInviteDto,
  GetApplicationInvitesQuery,
} from "./application.dto";
import { APPLICATION_STATUS, APPLICATION_INVITE_STATUS } from "../../common/constants/status.constant";
import { envConfig } from "../../config/env.config";
import { EmailService } from "../../common/services/email.service";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { prisma } from "../../database/prisma.client";
import { generateSecurePassword } from "../../common/helpers/password.helper";
import { validatePhoneUniqueness } from "../../common/helpers/phone.helper";

export class ApplicationService {
  private readonly repository = new ApplicationRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: ApplicationQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const application = await this.repository.findById(id);

    if (!application) {
      throw new AppError("Application not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return application;
  }

  async createInvite(actorId: string, data: CreateInviteDto) {
    const activeInvite = await this.repository.findActiveInviteByEmail(data.email);
    if (activeInvite) {
      throw new AppError(
        "An active invitation already exists for this email",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

    const invite = await this.repository.createInvite({
      email: data.email,
      token,
      expiresAt,
      createdBy: actorId,
    });

    const applyUrl = `${envConfig.app.baseUrl}/onboarding/${token}/policies`;

    const emailSubject = "[NexCampus] Thư mời nộp đơn đăng ký thực tập";
    const emailContent = `
      Chào bạn,<br/><br/>
      Bạn đã nhận được lời mời tham gia ứng tuyển thực tập tại NexCampus.<br/>
      Vui lòng nhấn vào liên kết dưới đây để điền thông tin đơn ứng tuyển (liên kết này chỉ có giá trị sử dụng một lần và hết hạn sau 24 giờ):<br/>
      <p style="margin: 16px 0;">
        <a href="${applyUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Nộp đơn ứng tuyển</a>
      </p>
      Hoặc sao chép liên kết này vào trình duyệt của bạn:<br/>
      <a href="${applyUrl}">${applyUrl}</a><br/><br/>
      Trân trọng,<br/>
      Đội ngũ NexCampus.
    `;

    await EmailService.sendMail(data.email, emailSubject, emailContent);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_APPLICATION_INVITE,
      `Quản trị viên đã gửi lời mời ứng tuyển tới candidate ${data.email}`
    );

    return {
      invite,
      link: applyUrl,
    };
  }

  async verifyInvite(token: string) {
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

    if (invite.status === APPLICATION_INVITE_STATUS.EXPIRED) {
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    // Check if expired by time (belt-and-suspenders: also update status in DB)
    if (invite.expiresAt < new Date()) {
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

  async create(data: CreateApplicationDto) {
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

    if (invite.status === APPLICATION_INVITE_STATUS.EXPIRED) {
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    if (invite.expiresAt < new Date()) {
      await this.repository.markInviteExpired(data.token);
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    // 2. Security check: Make sure email matches the invite email
    const normalizedEmail = data.email.toLowerCase().trim();
    if (normalizedEmail !== invite.email.toLowerCase().trim()) {
      throw new AppError(
        "Email does not match the invitation email",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new AppError(
        "A user with this email already exists in the system.",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // Check if application already exists (not REJECTED and not deleted)
    const existingApp = await prisma.application.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        status: { in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED] },
        deletedAt: null,
      },
    });
    if (existingApp) {
      throw new AppError(
        "An application with this email already exists and is pending or approved.",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // Verify regulation exists and is active
    const regulation = await prisma.regulation.findFirst({
      where: { id: data.regulationId, isActive: true },
    });
    if (!regulation) {
      throw new AppError(
        "Invalid or inactive regulation ID",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Create the application
    const application = await this.repository.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      departmentId: data.departmentId,
      positionId: data.positionId,
      startDate: new Date(data.startDate),
      duration: data.duration,
      regulationId: data.regulationId,
      acceptedAt: new Date(),
    });

    // 4. Mark invite as used
    await this.repository.markInviteAsUsed(data.token, application.id);

    return application;
  }

  async review(id: string, dto: ReviewApplicationDto, approverId: string) {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        `Đơn đăng ký đã ở trạng thái ${application.status.toLowerCase()}`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (dto.status === APPLICATION_STATUS.APPROVED) {
      const normalizedEmail = application.email.toLowerCase().trim();

      // Double check: if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        throw new AppError(
          "Người dùng với email này đã tồn tại trên hệ thống.",
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }

      await validatePhoneUniqueness(application.phone);

      // Get INTERN role
      const role = await prisma.role.findUnique({
        where: { name: "INTERN" },
      });
      if (!role) {
        throw new AppError("Không tìm thấy vai trò 'INTERN'", 404, ERROR_CODE.NOT_FOUND);
      }

      const password = generateSecurePassword();
      const passwordHash = await bcrypt.hash(password, 10);

      // Perform all DB updates in a transaction
      await prisma.$transaction(async (tx) => {
        // 1. Approve application
        await tx.application.update({
          where: { id },
          data: {
            status: APPLICATION_STATUS.APPROVED,
            approvedBy: approverId,
            approvedAt: new Date(),
          },
        });

        // 2. Create User account
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: passwordHash,
            fullName: application.fullName,
            roleId: role.id,
          },
        });

        // 3. Create Intern profile
        await tx.intern.create({
          data: {
            userId: user.id,
            fullName: application.fullName,
            phone: application.phone,
            ...(application.department?.id ? { departmentId: application.department.id } : {}),
            ...(application.position?.id ? { positionId: application.position.id } : {}),
            startDate: application.startDate,
            duration: application.duration,
          },
        });
      });

      // Send verification/confirmation email to the applicant
      try {
        const emailSubject = "[NexCampus] Tài khoản thực tập sinh của bạn đã được tạo";
        const emailContent = `
          Chào mừng bạn đến với NexCampus!<br/><br/>
          Đơn đăng ký thực tập của bạn tại NexCampus đã được phê duyệt.<br/>
          Tài khoản của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/>
          <ul>
            <li><strong>Email đăng nhập:</strong> ${normalizedEmail}</li>
            <li><strong>Mật khẩu:</strong> ${password}</li>
          </ul>
          Vui lòng truy cập <a href="${envConfig.app.baseUrl}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>
          Trân trọng,<br/>
          Đội ngũ NexCampus.
        `;
        await EmailService.sendMail(normalizedEmail, emailSubject, emailContent);
      } catch (emailError) {
        console.error(`[ApplicationService] Failed to send registration email to ${normalizedEmail}:`, emailError);
      }

      // Log activity
      await this.activityLogService.log(
        approverId,
        ACTIVITY_ACTIONS.CREATE_USER,
        `Quản trị viên đã phê duyệt đơn đăng ký của ${application.fullName} (${normalizedEmail}) và tạo tài khoản thực tập sinh.`,
        application.id,
        "Application",
      );

      try {
        return await this.repository.findById(id);
      } catch {
        return { id, message: "Application approved successfully" };
      }
    }

    if (dto.status === APPLICATION_STATUS.REJECTED) {
      const updatedApplication = await this.repository.review(
        id,
        APPLICATION_STATUS.REJECTED,
        approverId,
      );
      const normalizedEmail = updatedApplication.email.toLowerCase().trim();

      // Send rejection email to the applicant
      try {
        const emailSubject = "[NexCampus] Kết quả đăng ký thực tập tại NexCampus";
        const emailContent = `
          Chào bạn,<br/><br/>
          Cảm ơn bạn đã quan tâm và nộp đơn đăng ký thực tập tại NexCampus.<br/>
          Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa phù hợp với các tiêu chí tuyển chọn hiện tại của chúng tôi.<br/>
          Thông tin chi tiết về đơn đăng ký của bạn:<br/>
          <ul>
            <li><strong>Họ và tên:</strong> ${updatedApplication.fullName}</li>
            <li><strong>Vị trí ứng tuyển:</strong> ${updatedApplication.position}</li>
            <li><strong>Phòng ban:</strong> ${updatedApplication.department}</li>
          </ul>
          Chúng tôi rất hy vọng sẽ có cơ hội được hợp tác với bạn trong các chương trình tiếp theo. Chúc bạn luôn nhiều sức khỏe và thành công trên con đường sự nghiệp sắp tới.<br/><br/>
          Trân trọng,<br/>
          Đội ngũ NexCampus.
        `;
        await EmailService.sendMail(normalizedEmail, emailSubject, emailContent);
      } catch (emailError) {
        console.error(
          `[ApplicationService] Failed to send rejection email to ${normalizedEmail}:`,
          emailError,
        );
      }

      return updatedApplication;
    }

    return this.repository.review(id, dto.status, approverId);
  }

  async delete(id: string) {
    const application = await this.findById(id);

    if (application.status === APPLICATION_STATUS.APPROVED) {
      throw new AppError(
        "Cannot delete an approved application",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.softDelete(id);
  }

  async revokeInvite(id: string, actorId: string) {
    const invite = await this.repository.findInviteById(id);

    if (!invite) {
      throw new AppError("Invite not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (invite.status === APPLICATION_INVITE_STATUS.USED || invite.status === APPLICATION_INVITE_STATUS.EXPIRED) {
      throw new AppError(
        `Cannot revoke invite with status ${invite.status}`,
        400,
        ERROR_CODE.TOKEN_REVOKED,
      );
    }

    if (invite.status === APPLICATION_INVITE_STATUS.REVOKED) {
      throw new AppError(
        "Invite is already revoked",
        400,
        ERROR_CODE.TOKEN_REVOKED,
      );
    }

    await this.repository.revokeInvite(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.REVOKE_APPLICATION_INVITE,
      `Quản trị viên đã thu hồi lời mời ứng tuyển của ${invite.email}`,
      id,
      "ApplicationInvite",
    );
  }

  async getApplicationInvites(query: GetApplicationInvitesQuery) {
    try {
      await this.repository.markExpiredInvites();
      return await this.repository.findApplicationInvites(query);
    } catch (err) {
      console.error("[getApplicationInvites] ERROR:", err);
      throw err;
    }
  }

  async getInviteById(id: string) {
    const invite = await this.repository.findInviteById(id);

    if (!invite) {
      throw new AppError("Invite not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return invite;
  }
}
