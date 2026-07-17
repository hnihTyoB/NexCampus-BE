import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepository } from "./auth.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { jwtConfig } from "../../config/jwt.config";
import { envConfig } from "../../config/env.config";
import {
  LoginDto,
  LoginResponseDto,
  AuthTokensDto,
  MeDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from "./auth.dto";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { EmailService } from "../../common/services/email.service";

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly activityLogService = new ActivityLogService();

  async login(
    data: LoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    const { email, password, rememberMe } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Invalid credentials",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    if (!user.isActive) {
      throw new AppError("Account is inactive", 403, ERROR_CODE.USER_INACTIVE);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError(
        "Invalid credentials",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      rememberMe: !!rememberMe,
    };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: (jwtConfig.refreshExpiresIn || "7d") as any,
    });

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.LOGIN,
      `Người dùng ${user.fullName || user.email} đã đăng nhập hệ thống${metadata?.ipAddress ? ` từ IP ${metadata.ipAddress}` : ""}`
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
      },
    };
  }

  async refresh(
    token: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokensDto> {
    let payload: any;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (error) {
      throw new AppError(
        "Invalid refresh token",
        401,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    const savedToken = await this.repository.findRefreshToken(token);
    if (!savedToken) {
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (savedToken.expiresAt < new Date()) {
      await this.repository.deleteRefreshToken(token);
      throw new AppError(
        "Refresh token expired",
        401,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError(
        "User not found or inactive",
        401,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    const rememberMe = !!payload.rememberMe;
    const newPayload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      rememberMe,
    };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const newRefreshToken = jwt.sign(newPayload, jwtConfig.refreshSecret, {
      expiresIn: (jwtConfig.refreshExpiresIn || "7d") as any,
    });

    await this.repository.deleteRefreshToken(token);

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      newRefreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string, userId?: string) {
    const result = await this.repository.deleteRefreshToken(token);

    if (result.count === 0) {
      throw new AppError(
        "Refresh token not found or already invalidated",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (userId) {
      const user = await this.repository.findById(userId);
      if (user) {
        await this.activityLogService.log(
          userId,
          ACTIVITY_ACTIONS.LOGOUT,
          `Người dùng ${user.fullName || user.email} đã đăng xuất`
        );
      }
    }
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      intern: user.intern
        ? {
            id: user.intern.id,
            phone: user.intern.phone,
            department: user.intern.department,
            position: user.intern.position,
            startDate: user.intern.startDate,
            duration: user.intern.duration,
            discordUsername: user.intern.discordUsername,
            discordRoleGranted: user.intern.discordRoleGranted,
            status: user.intern.status,
          }
        : null,
      leader: user.leader
        ? {
            id: user.leader.id,
            department: user.leader.department,
            position: user.leader.position,
            phone: user.leader.phone,
          }
        : null,
      notificationSetting: user.notificationSetting
        ? {
            id: user.notificationSetting.id,
            webEnabled: user.notificationSetting.webEnabled,
            emailEnabled: user.notificationSetting.emailEnabled,
            discordEnabled: user.notificationSetting.discordEnabled,
          }
        : null,
    };
  }

  async updateMe(
    userId: string,
    data: { fullName?: string; password?: string; avatarUrl?: string },
  ): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.repository.updateMe(userId, data);

    const changes: string[] = [];
    if (data.fullName !== undefined) changes.push("họ tên");
    if (data.password !== undefined) changes.push("mật khẩu");
    if (data.avatarUrl !== undefined) changes.push("ảnh đại diện");

    await this.activityLogService.log(
      userId,
      ACTIVITY_ACTIONS.UPDATE_PROFILE,
      `Người dùng ${updatedUser.fullName || updatedUser.email} đã cập nhật ${changes.join(", ")}`
    );

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role.name,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      intern: updatedUser.intern
        ? {
            id: updatedUser.intern.id,
            phone: updatedUser.intern.phone,
            department: updatedUser.intern.department,
            position: updatedUser.intern.position,
            startDate: updatedUser.intern.startDate,
            duration: updatedUser.intern.duration,
            discordUsername: updatedUser.intern.discordUsername,
            discordRoleGranted: updatedUser.intern.discordRoleGranted,
            status: updatedUser.intern.status,
          }
        : null,
      leader: updatedUser.leader
        ? {
            id: updatedUser.leader.id,
            department: updatedUser.leader.department,
            position: updatedUser.leader.position,
            phone: updatedUser.leader.phone,
          }
        : null,
      notificationSetting: updatedUser.notificationSetting
        ? {
            id: updatedUser.notificationSetting.id,
            webEnabled: updatedUser.notificationSetting.webEnabled,
            emailEnabled: updatedUser.notificationSetting.emailEnabled,
            discordEnabled: updatedUser.notificationSetting.discordEnabled,
          }
        : null,
    };
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<void> {
    const { email } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError("Email not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!user.isActive) {
      throw new AppError("Account is inactive", 403, ERROR_CODE.USER_INACTIVE);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.repository.updateResetToken(user.id, token, expiresAt);

    const resetLink = `${envConfig.app.baseUrl}/reset-password?token=${token}`;

    const emailSubject = "[NexCampus] Khôi phục mật khẩu";
    const emailContent = `
      Bạn đã yêu cầu khôi phục mật khẩu tài khoản NexCampus.<br/>
      Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu mới (liên kết có hiệu lực trong 1 giờ):<br/>
      <p style="margin: 16px 0;">
        <a href="${resetLink}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Đặt lại mật khẩu</a>
      </p>
      Hoặc sao chép liên kết này vào trình duyệt:<br/>
      <a href="${resetLink}">${resetLink}</a>
    `;

    await EmailService.sendMail(user.email, emailSubject, emailContent);

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.FORGOT_PASSWORD,
      `Người dùng ${user.fullName || user.email} đã yêu cầu đặt lại mật khẩu`
    );
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const { token, password } = data;
    const user = await this.repository.findByResetToken(token);

    if (!user) {
      throw new AppError(
        "Invalid or expired password reset token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new AppError(
        "Password reset token has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.repository.updatePassword(user.id, passwordHash);

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.RESET_PASSWORD,
      `Người dùng ${user.fullName || user.email} đã đặt lại mật khẩu thành công`
    );
  }

  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const { oldPassword, newPassword } = data;

    if (!oldPassword || !newPassword) {
      throw new AppError(
        "Mật khẩu cũ và mật khẩu mới không được để trống",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Mật khẩu cũ không chính xác",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new AppError(
        "Mật khẩu mới không được trùng với mật khẩu cũ",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repository.updatePassword(user.id, passwordHash);

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.CHANGE_PASSWORD,
      `Người dùng ${user.fullName || user.email} đã đổi mật khẩu thành công`
    );
  }
}
