import crypto from "crypto";
import { ApplicationRepository } from "./application.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  ApplicationQueryDto,
  CreateApplicationDto,
  ReviewApplicationDto,
  CreateInviteDto,
} from "./application.dto";
import { APPLICATION_STATUS } from "../../common/constants/status.constant";
import { envConfig } from "../../config/env.config";
import { EmailService } from "../../common/services/email.service";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

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
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

    const invite = await this.repository.upsertInvite(data.email, token, expiresAt);

    const applyUrl = `${envConfig.app.baseUrl}/apply?token=${token}`;

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

    if (invite.used) {
      throw new AppError(
        "This invitation link has already been used",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (invite.expiresAt < new Date()) {
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

    if (invite.used) {
      throw new AppError(
        "This invitation link has already been used",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new AppError(
        "This invitation link has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    // 2. Security check: Make sure email matches the invite email
    if (data.email.toLowerCase().trim() !== invite.email.toLowerCase().trim()) {
      throw new AppError(
        "Email does not match the invitation email",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Create the application
    const application = await this.repository.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      department: data.department,
      position: data.position,
      startDate: new Date(data.startDate),
      duration: data.duration,
    });

    // 4. Mark invite as used
    await this.repository.markInviteAsUsed(data.token);

    return application;
  }

  async review(id: string, dto: ReviewApplicationDto, approverId: string) {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        `Application is already ${application.status.toLowerCase()}`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
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
}
