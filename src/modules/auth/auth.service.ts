import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepository } from "./auth.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { jwtConfig } from "../../config/jwt.config";
import { r2Config } from "../../config/r2.config";
import {
  LoginDto,
  LoginResponseDto,
  AuthTokensDto,
  MeDto,
  RegisterDto,
  UpdateProfileDto,
  UpdatePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  GetAvatarUploadUrlDto,
  GetAvatarUploadUrlResponseDto,
  ConfirmAvatarUploadDto,
  RequestDeactivateDto,
  ConfirmDeactivateDto,
  Setup2FAResponseDto,
  Enable2FADto,
  Enable2FAResponseDto,
  Verify2FALoginDto,
  Disable2FADto,
  RegenerateBackupCodesDto,
  GoogleLoginDto,
  GoogleAuthUrlQueryDto,
  GoogleAuthUrlResponseDto,
  LinkSocialAccountDto,
  SocialAccountDto,
  UnlinkSocialAccountParamDto,
} from "./auth.dto";
import { MailService } from "../../common/services/mail.service";
import { R2Service } from "../../common/services/r2.service";
import { ROLES } from "../../common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { AUTH_PROVIDER } from "../../common/constants/auth.constant";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
} from "../../common/constants/notification.constant";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  generateDeviceHash,
  parseUserAgent,
} from "../../common/helpers/user-agent.helper";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  encryptSecret,
  decryptSecret,
  hashToken,
} from "../../common/helpers/crypto.helper";
import {
  generateTotpSecret,
  generateOtpauthUri,
  verifyTotpCode,
  generateBackupCodes,
} from "../../common/helpers/totp.helper";
import { envConfig } from "../../config/env.config";
import {
  verifyGoogleIdToken,
  exchangeGoogleCode,
  generateGoogleAuthUrl,
} from "../../common/helpers/google-auth.helper";

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly mailService = new MailService();
  private readonly r2Service = new R2Service();

  async login(
    data: LoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    const { email, password } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Invalid credentials",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa. Vui lòng xác thực email hoặc liên hệ quản trị viên.",
        403,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    if (!user.password) {
      throw new AppError(
        "Invalid credentials",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError(
        "Invalid credentials",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    // Nếu người dùng đã kích hoạt 2FA, trả về thử thách 2FA kèm tempToken hạn 5 phút
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );
      return {
        requires2FA: true,
        tempToken,
      };
    }

    return this.issueAuthTokens(user, metadata);
  }

  /**
   * Tạo JWT tokens, quản lý phiên và ghi nhận thiết bị đăng nhập dùng chung cho các luồng xác thực.
   */
  private async issueAuthTokens(
    user: {
      id: string;
      email: string | null;
      fullName: string | null;
      role: { name: string };
      roleId: string;
    },
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
    };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions["expiresIn"],
    });

    const refreshToken = jwt.sign(
      { ...payload, jti: crypto.randomUUID() },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions["expiresIn"] },
    );

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

    // Theo dõi thiết bị và cảnh báo đăng nhập lạ
    if (metadata?.userAgent) {
      const deviceHash = generateDeviceHash(metadata.userAgent);
      const parsedDevice = parseUserAgent(metadata.userAgent);

      const existingDevice = await this.repository.findUserDevice(
        user.id,
        deviceHash,
      );
      if (!existingDevice) {
        await this.repository.upsertUserDevice({
          userId: user.id,
          deviceHash,
          deviceName: parsedDevice,
          ipAddress: metadata.ipAddress,
        });

        if (user.email) {
          this.mailService
            .sendNewDeviceAlertEmail(
              user.email,
              {
                deviceName: parsedDevice,
                ipAddress: metadata.ipAddress || "Không rõ",
                loginTime: new Date(),
              },
              user.fullName || undefined,
            )
            .catch((err) => {
              console.error("Failed to send unrecognized device email:", err);
            });
        }

        notificationDispatcher
          .notify(
            user.id,
            NOTIFICATION_TYPE.ALERT,
            "Phát hiện đăng nhập từ thiết bị mới",
            `Tài khoản của bạn vừa được đăng nhập từ thiết bị: ${parsedDevice} (IP: ${metadata.ipAddress || "Không rõ"}).`,
            { priority: NOTIFICATION_PRIORITY.HIGH },
          )
          .catch((err) => {
            console.error("Failed to notify unrecognized device in-app:", err);
          });
      } else {
        await this.repository.updateUserDeviceLastLogin(
          user.id,
          deviceHash,
          metadata.ipAddress,
        );
      }
    }

    const permissions = Array.from(
      await permissionCacheService.getRolePermissions(user.roleId),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
        roleId: user.roleId,
        permissions,
      },
    };
  }

  /**
   * Đăng nhập hoặc liên kết tài khoản bằng Google OAuth2 (ID Token hoặc Authorization Code).
   */
  async googleLogin(
    data: GoogleLoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    let idToken = data.idToken;

    // Nếu người dùng cung cấp authorization code, thực hiện trao đổi lấy ID Token
    if (!idToken && data.code) {
      if (!envConfig.google.clientId || !envConfig.google.clientSecret) {
        throw new AppError(
          "Google OAuth2 Client ID hoặc Client Secret chưa được cấu hình trên hệ thống",
          500,
          ERROR_CODE.CONFIGURATION_ERROR,
        );
      }
      const tokenRes = await exchangeGoogleCode(
        data.code,
        data.redirectUri!,
        envConfig.google.clientId,
        envConfig.google.clientSecret,
      );
      idToken = tokenRes.idToken;
    }

    if (!idToken) {
      throw new AppError(
        "Không tìm thấy Google ID Token để xác thực",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Xác thực Google ID Token
    const googleProfile = await verifyGoogleIdToken(
      idToken,
      envConfig.google.clientId || undefined,
    );

    // 1. Kiểm tra tài khoản đã liên kết với Google trước đó chưa
    let user = await this.repository.findBySocial(
      AUTH_PROVIDER.GOOGLE,
      googleProfile.providerUserId,
    );

    if (user) {
      // Tài khoản đã liên kết
      if (user.deletedAt) {
        throw new AppError(
          "Tài khoản đã bị vô hiệu hóa hoặc xóa.",
          403,
          ERROR_CODE.USER_INACTIVE,
        );
      }
      if (!user.isActive) {
        // Tự động kích hoạt tài khoản vì Google đã xác minh email thành công
        await this.repository.activateUser(user.id);
        const refreshedUser = await this.repository.findById(user.id);
        if (refreshedUser) {
          user = refreshedUser;
        }
      }
    } else {
      // 2. Nếu chưa liên kết qua UserSocial, kiểm tra theo email
      const existingUser = await this.repository.findByEmail(
        googleProfile.email,
      );

      if (existingUser) {
        if (existingUser.deletedAt) {
          throw new AppError(
            "Tài khoản đã bị vô hiệu hóa hoặc xóa.",
            403,
            ERROR_CODE.USER_INACTIVE,
          );
        }

        // Liên kết tài khoản Google với User hiện tại
        await this.repository.linkSocialAccount(
          existingUser.id,
          AUTH_PROVIDER.GOOGLE,
          googleProfile.providerUserId,
        );

        // Kích hoạt nếu user cũ chưa kích hoạt email
        if (!existingUser.isActive) {
          await this.repository.activateUser(existingUser.id);
          existingUser.isActive = true;
        }

        user = existingUser;

        await this.repository.createAuditLog({
          actorId: user.id,
          action: AUDIT_ACTION.LINK_SOCIAL_ACCOUNT,
          targetType: AUDIT_TARGET_TYPE.USER,
          targetId: user.id,
          details: {
            provider: AUTH_PROVIDER.GOOGLE,
            email: googleProfile.email,
          },
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        });
      } else {
        // 3. User mới hoàn toàn -> Tạo user mới với vai trò mặc định USER
        const defaultRole = await this.repository.findRoleByName(ROLES.USER);
        if (!defaultRole) {
          throw new AppError(
            "Vai trò người dùng mặc định không tồn tại",
            500,
            ERROR_CODE.INTERNAL_SERVER_ERROR,
          );
        }

        user = await this.repository.createSocialUser({
          email: googleProfile.email,
          fullName: googleProfile.fullName,
          avatarUrl: googleProfile.avatarUrl,
          roleId: defaultRole.id,
          provider: AUTH_PROVIDER.GOOGLE,
          providerUserId: googleProfile.providerUserId,
        });
      }
    }

    // 4. Bảo vệ 2FA: Nếu tài khoản đã kích hoạt 2FA, không được bypass mà phải qua thử thách 2FA
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );
      return {
        requires2FA: true,
        tempToken,
      };
    }

    // 5. Cấp phát phiên làm việc và tokens
    const authResult = await this.issueAuthTokens(user, metadata);

    await this.repository.createAuditLog({
      actorId: user.id,
      action: AUDIT_ACTION.LOGIN_GOOGLE,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: user.id,
      details: { provider: AUTH_PROVIDER.GOOGLE, email: googleProfile.email },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return authResult;
  }

  /**
   * Tạo URL chuyển hướng đăng nhập Google OAuth2.
   */
  getGoogleAuthUrl(query: GoogleAuthUrlQueryDto): GoogleAuthUrlResponseDto {
    if (!envConfig.google.clientId) {
      throw new AppError(
        "Google Client ID chưa được cấu hình trên hệ thống",
        500,
        ERROR_CODE.CONFIGURATION_ERROR,
      );
    }
    const redirectUri =
      query.redirectUri || "http://localhost:7777/api/v1/auth/google/callback";
    const url = generateGoogleAuthUrl(
      envConfig.google.clientId,
      redirectUri,
      query.state,
    );
    return { url };
  }

  /**
   * Lấy danh sách các tài khoản mạng xã hội đã liên kết của người dùng.
   */
  async getSocialAccounts(userId: string): Promise<SocialAccountDto[]> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return this.repository.getUserSocialAccounts(userId);
  }

  /**
   * Chủ động liên kết tài khoản mạng xã hội (Google) trong trang cá nhân Profile.
   */
  async linkSocialAccount(
    userId: string,
    data: LinkSocialAccountDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ provider: string; email?: string }> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const provider = data.provider || AUTH_PROVIDER.GOOGLE;
    if (provider !== AUTH_PROVIDER.GOOGLE) {
      throw new AppError(
        `Nhà cung cấp ${provider} chưa được hỗ trợ liên kết`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 1. Kiểm tra tài khoản hiện tại đã liên kết với Google chưa
    const existingLinkForThisUser =
      await this.repository.findUserSocialByProvider(userId, provider);
    if (existingLinkForThisUser) {
      throw new AppError(
        "Tài khoản của bạn đã được liên kết với Google",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 2. Lấy ID Token từ idToken hoặc authorization code
    let idToken = data.idToken;
    if (!idToken && data.code) {
      if (!envConfig.google.clientId || !envConfig.google.clientSecret) {
        throw new AppError(
          "Google OAuth2 Client ID hoặc Client Secret chưa được cấu hình trên hệ thống",
          500,
          ERROR_CODE.CONFIGURATION_ERROR,
        );
      }
      const tokenRes = await exchangeGoogleCode(
        data.code,
        data.redirectUri!,
        envConfig.google.clientId,
        envConfig.google.clientSecret,
      );
      idToken = tokenRes.idToken;
    }

    if (!idToken) {
      throw new AppError(
        "Không tìm thấy Google ID Token để liên kết",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Xác thực Google ID Token
    const profile = await verifyGoogleIdToken(
      idToken,
      envConfig.google.clientId || undefined,
    );

    // 4. Kiểm tra tài khoản Google này đã được liên kết với một user khác trong hệ thống chưa (Collision guard)
    const existingSocialUser = await this.repository.findBySocial(
      provider,
      profile.providerUserId,
    );
    if (existingSocialUser) {
      if (existingSocialUser.id === userId) {
        throw new AppError(
          "Tài khoản Google này đã được liên kết với bạn trước đó",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      throw new AppError(
        "Tài khoản Google này đã được liên kết với một tài khoản người dùng khác trong hệ thống",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // 5. Tiến hành liên kết
    await this.repository.linkSocialAccount(
      userId,
      provider,
      profile.providerUserId,
    );

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.LINK_SOCIAL_ACCOUNT,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: {
        provider,
        email: profile.email,
        source: "PROFILE_MANUAL_LINK",
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      provider,
      email: profile.email,
    };
  }

  /**
   * Hủy liên kết tài khoản mạng xã hội (kèm chốt chặn an toàn Anti-Lockout).
   */
  async unlinkSocialAccount(
    userId: string,
    provider: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 1. Kiểm tra tài khoản có liên kết với provider này không
    const existingLink = await this.repository.findUserSocialByProvider(
      userId,
      provider,
    );
    if (!existingLink) {
      throw new AppError(
        `Tài khoản chưa được liên kết với ${provider}`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 2. Chống tự khóa tài khoản (Anti-Lockout Protection):
    // Nếu user chưa đặt password VÀ chỉ có 1 tài khoản social duy nhất, không cho phép hủy liên kết!
    if (!user.password) {
      const totalSocialAccounts =
        await this.repository.countUserSocialAccounts(userId);
      if (totalSocialAccounts <= 1) {
        throw new AppError(
          "Không thể hủy phương thức đăng nhập duy nhất khi bạn chưa thiết lập mật khẩu tài khoản. Vui lòng tạo mật khẩu trước khi hủy liên kết.",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // 3. Xóa liên kết
    await this.repository.unlinkSocialAccount(userId, provider);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.UNLINK_SOCIAL_ACCOUNT,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { provider },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
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

    const newPayload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
    };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions["expiresIn"],
    });

    const newRefreshToken = jwt.sign(
      { ...newPayload, jti: crypto.randomUUID() },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions["expiresIn"] },
    );

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.rotateRefreshToken(
      user.id,
      token,
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

  async logout(token: string) {
    const result = await this.repository.deleteRefreshToken(token);

    if (result.count === 0) {
      throw new AppError(
        "Refresh token not found or already invalidated",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const permissions = Array.from(
      await permissionCacheService.getRolePermissions(user.roleId),
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phoneNumber: user.phoneNumber,
      role: user.role.name,
      roleId: user.roleId,
      permissions,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    };
  }

  async register(data: RegisterDto): Promise<void> {
    const { email, password, fullName } = data;

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      throw new AppError(
        "Email already exists",
        400,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const defaultRole = await this.repository.findRoleByName(ROLES.USER);
    if (!defaultRole) {
      throw new AppError("Default role not found", 500, ERROR_CODE.NOT_FOUND);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.repository.registerUserWithVerification(
      {
        email,
        passwordHash,
        fullName,
        roleId: defaultRole.id,
        isActive: false,
      },
      token,
      expiresAt,
    );

    try {
      await this.mailService.sendVerificationEmail(
        email,
        token,
        fullName || undefined,
      );
    } catch (mailErr: any) {
      console.warn(
        `[AuthService] Failed to send verification email to ${email}:`,
        mailErr?.message || mailErr,
      );
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationToken =
      await this.repository.findVerificationToken(token);

    if (!verificationToken) {
      throw new AppError(
        "Invalid verification token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      await this.repository.deleteVerificationToken(verificationToken.id);
      throw new AppError(
        "Verification token has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    await this.repository.activateUserAndDeleteToken(
      verificationToken.userId,
      verificationToken.id,
    );

    notificationDispatcher
      .notify(
        verificationToken.userId,
        NOTIFICATION_TYPE.SUCCESS,
        "Xác thực tài khoản thành công",
        "Chào mừng bạn đến với hệ thống! Tài khoản của bạn đã được kích hoạt thành công.",
      )
      .catch((err) =>
        console.error("Failed to dispatch welcome notification:", err),
      );
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.phoneNumber) {
      const existingPhone = await this.repository.findByPhone(data.phoneNumber);
      if (existingPhone && existingPhone.id !== userId) {
        throw new AppError(
          "Phone number already exists",
          400,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    await this.repository.updateProfile(userId, data);

    notificationDispatcher
      .notify(
        userId,
        NOTIFICATION_TYPE.INFO,
        "Cập nhật thông tin thành công",
        "Hồ sơ cá nhân của bạn đã được cập nhật thành công.",
      )
      .catch((err) =>
        console.error("Failed to dispatch update profile notification:", err),
      );
  }

  async updatePassword(userId: string, data: UpdatePasswordDto): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.password) {
      if (!data.oldPassword) {
        throw new AppError(
          "Old password is required",
          400,
          ERROR_CODE.INVALID_CREDENTIALS,
        );
      }
      const isPasswordValid = await bcrypt.compare(
        data.oldPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw new AppError(
          "Invalid old password",
          401,
          ERROR_CODE.INVALID_CREDENTIALS,
        );
      }
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.updatePasswordAndRevokeTokens(userId, passwordHash);

    notificationDispatcher
      .notify(
        userId,
        NOTIFICATION_TYPE.WARNING,
        "Đổi mật khẩu thành công",
        "Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.",
        { priority: NOTIFICATION_PRIORITY.HIGH },
      )
      .catch((err) =>
        console.error("Failed to dispatch password changed notification:", err),
      );
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<void> {
    const user = await this.repository.findByEmail(data.email);
    if (!user || !user.email) {
      // Return gracefully to prevent account enumeration
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.repository.createPasswordResetToken(user.id, token, expiresAt);

    await this.mailService.sendPasswordResetEmail(
      user.email,
      token,
      user.fullName || undefined,
    );
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const resetToken = await this.repository.findPasswordResetToken(data.token);
    if (!resetToken) {
      throw new AppError(
        "Invalid or expired reset token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (resetToken.expiresAt < new Date()) {
      await this.repository.deletePasswordResetToken(resetToken.id);
      throw new AppError(
        "Reset token has expired",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.resetPasswordAndRevokeTokens(
      resetToken.userId,
      passwordHash,
      resetToken.id,
    );

    notificationDispatcher
      .notify(
        resetToken.userId,
        NOTIFICATION_TYPE.WARNING,
        "Đặt lại mật khẩu thành công",
        "Mật khẩu tài khoản của bạn vừa được đặt lại thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.",
        { priority: NOTIFICATION_PRIORITY.HIGH },
      )
      .catch((err) =>
        console.error("Failed to dispatch reset password notification:", err),
      );
  }

  async resendVerification(data: ResendVerificationDto): Promise<void> {
    const user = await this.repository.findByEmail(data.email);
    if (!user || !user.email) {
      // Return gracefully to prevent account enumeration
      return;
    }

    if (user.isActive) {
      // If already active, return gracefully without error
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.repository.createVerificationToken(user.id, token, expiresAt);

    await this.mailService.sendVerificationEmail(
      user.email,
      token,
      user.fullName || undefined,
    );
  }

  async getActiveSessions(userId: string, currentToken?: string) {
    const sessions = await this.repository.findSessionsByUserId(userId);
    // So sánh hash vì DB đang lưu SHA-256 hash của token
    const hashedCurrentToken = currentToken
      ? crypto.createHash("sha256").update(currentToken).digest("hex")
      : undefined;
    return sessions.map((session) => ({
      id: session.id,
      deviceName: parseUserAgent(session.userAgent || undefined),
      ipAddress: session.ipAddress || "Không rõ",
      createdAt: session.createdAt,
      isCurrent: hashedCurrentToken
        ? session.token === hashedCurrentToken
        : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.repository.findSessionById(userId, sessionId);
    if (!session) {
      throw new AppError("Session not found", 404, ERROR_CODE.NOT_FOUND);
    }
    await this.repository.deleteSessionById(userId, sessionId);
  }

  async revokeAllOtherSessions(userId: string, currentToken: string) {
    await this.repository.deleteOtherSessions(userId, currentToken);
  }

  /**
   * Bước 1: Tạo presigned PUT URL để client upload avatar trực tiếp lên R2.
   * Client cần crop ảnh trước khi upload (server không xử lý ảnh).
   */
  async getAvatarUploadUrl(
    userId: string,
    data: GetAvatarUploadUrlDto,
  ): Promise<GetAvatarUploadUrlResponseDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const ext = data.contentType.split("/")[1] ?? "webp";
    const key = `avatars/${userId}/${Date.now()}.${ext}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      key,
      data.contentType,
    );
    const publicUrl = this.r2Service.getPublicUrl(key);

    return {
      uploadUrl,
      publicUrl,
      key,
      expiresIn: r2Config.presignedUrlExpiresIn,
    };
  }

  /**
   * Bước 2: Sau khi client upload xong, xác nhận key và lưu avatar_url vào DB.
   * Nếu user đã có avatar cũ trên R2, xóa file cũ đi.
   */
  async confirmAvatarUpload(
    userId: string,
    data: ConfirmAvatarUploadDto,
  ): Promise<string> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // Chỉ cho phép key thuộc về chính user này
    const expectedPrefix = `avatars/${userId}/`;
    if (!data.key.startsWith(expectedPrefix)) {
      throw new AppError("Invalid avatar key", 403, ERROR_CODE.FORBIDDEN);
    }

    const newAvatarUrl = this.r2Service.getPublicUrl(data.key);

    // Lấy key cũ từ avatar_url hiện tại trước khi ghi đè
    let oldKey: string | null = null;
    if (user.avatarUrl) {
      const base = r2Config.publicBaseUrl.replace(/\/$/, "");
      if (user.avatarUrl.startsWith(base)) {
        oldKey = user.avatarUrl.slice(base.length + 1); // loại bỏ "base/"
      }
    }

    // Cập nhật avatar_url vào DB
    await this.repository.updateProfile(userId, { avatarUrl: newAvatarUrl });

    notificationDispatcher
      .notify(
        userId,
        NOTIFICATION_TYPE.INFO,
        "Cập nhật ảnh đại diện thành công",
        "Ảnh đại diện của bạn đã được tải lên và lưu thành công.",
      )
      .catch((err) =>
        console.error("Failed to dispatch avatar notification:", err),
      );

    // Xóa file cũ (thực hiện sau khi DB đã cập nhật thành công)
    if (oldKey && oldKey !== data.key) {
      await this.r2Service.deleteFile(oldKey).catch(() => {
        // Không throw nếu xóa file cũ thất bại — không ảnh hưởng đến flow chính
      });
    }

    return newAvatarUrl;
  }

  async requestDeactivate(
    userId: string,
    data: RequestDeactivateDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!user.isActive) {
      throw new AppError(
        "Tài khoản đã bị vô hiệu hóa trước đó",
        400,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    if (!user.password) {
      throw new AppError(
        "Tài khoản liên kết mạng xã hội không thể vô hiệu hóa bằng mật khẩu",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Mật khẩu hiện tại không chính xác",
        400,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    // Anti-lockout: Nếu user là ADMIN, kiểm tra xem có còn admin nào khác không
    if (user.role.name === ROLES.ADMIN) {
      const activeAdminCount = await this.repository.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new AppError(
          "Không thể vô hiệu hóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    if (!user.email) {
      throw new AppError(
        "Tài khoản không có email để nhận mã xác nhận vô hiệu hóa",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Sinh token có hạn 15 phút
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.repository.createDeactivationToken(userId, token, expiresAt);

    // Gửi email xác nhận
    await this.mailService.sendAccountDeactivationEmail(
      user.email,
      token,
      user.fullName || undefined,
    );

    // Ghi audit log
    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.REQUEST_ACCOUNT_DEACTIVATION,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { reason: data.reason || null },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }

  async confirmDeactivate(
    data: ConfirmDeactivateDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const record = await this.repository.findDeactivationToken(data.token);
    if (!record) {
      throw new AppError(
        "Mã xác nhận vô hiệu hóa không hợp lệ hoặc đã được sử dụng",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (record.expiresAt < new Date()) {
      await this.repository.deleteVerificationToken(record.id);
      throw new AppError(
        "Mã xác nhận vô hiệu hóa đã hết hạn (chỉ có hiệu lực trong 15 phút)",
        400,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    // Anti-lockout lần 2 tại thời điểm confirm
    if (record.user.role.name === ROLES.ADMIN) {
      const activeAdminCount = await this.repository.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new AppError(
          "Không thể vô hiệu hóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // Vô hiệu hóa tài khoản, xóa toàn bộ session/refresh tokens và xóa token
    await this.repository.deactivateUserAndRevokeSessions(
      record.userId,
      record.id,
    );

    // Xóa cache user để permission middleware lập tức chặn access token cũ
    permissionCacheService.invalidateUser(record.userId);

    // Ghi audit log
    await this.repository.createAuditLog({
      actorId: record.userId,
      action: AUDIT_ACTION.CONFIRM_ACCOUNT_DEACTIVATION,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: record.userId,
      details: { deactivationTime: new Date() },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }

  // ────── Two-Factor Authentication (2FA / TOTP) ──────

  async setup2FA(userId: string): Promise<Setup2FAResponseDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.twoFactorEnabled) {
      throw new AppError(
        "Xác thực 2 bước đã được kích hoạt trên tài khoản này",
        400,
        ERROR_CODE.TWO_FACTOR_ALREADY_ENABLED,
      );
    }

    const secret = generateTotpSecret(20);
    const appName = "TemplateBE";
    const otpauthUrl = generateOtpauthUri({
      issuer: appName,
      accountName: user.email || user.id,
      secret,
    });

    return { secret, otpauthUrl };
  }

  async enable2FA(
    userId: string,
    data: Enable2FADto,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      currentRefreshToken?: string;
    },
  ): Promise<Enable2FAResponseDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.twoFactorEnabled) {
      throw new AppError(
        "Xác thực 2 bước đã được kích hoạt trước đó",
        400,
        ERROR_CODE.TWO_FACTOR_ALREADY_ENABLED,
      );
    }

    const isValid = verifyTotpCode(data.secret, data.code);
    if (!isValid) {
      throw new AppError(
        "Mã xác thực TOTP không chính xác hoặc đã hết hạn",
        400,
        ERROR_CODE.TWO_FACTOR_INVALID_CODE,
      );
    }

    const encryptedSecret = encryptSecret(data.secret);
    const { plainCodes, hashedCodes } = generateBackupCodes(8);

    await this.repository.enable2FA(userId, encryptedSecret, hashedCodes);

    // Thu hồi toàn bộ phiên đăng nhập khác, bảo lưu phiên hiện tại đang thao tác
    await this.repository.revokeOtherSessions(
      userId,
      metadata?.currentRefreshToken,
    );
    permissionCacheService.invalidateUser(userId);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.ENABLE_2FA,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { backupCodes: plainCodes };
  }

  async verify2FALogin(
    data: Verify2FALoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    let payload: any;
    try {
      payload = jwt.verify(data.tempToken, jwtConfig.accessSecret);
    } catch {
      throw new AppError(
        "Mã phiên xác thực 2FA không hợp lệ hoặc đã hết hạn",
        401,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    if (payload.purpose !== "2FA_VERIFICATION" || !payload.id) {
      throw new AppError(
        "Token xác thực 2FA không đúng mục đích",
        401,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    const user = await this.repository.findById(payload.id);
    if (
      !user ||
      !user.isActive ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecret
    ) {
      throw new AppError(
        "Tài khoản không khả dụng hoặc chưa kích hoạt 2FA",
        400,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const cleanCode = data.code.trim();
    let isCodeValid = false;

    // 1. Thử xác thực như mã TOTP 6 số
    if (/^\d{6}$/.test(cleanCode)) {
      const decryptedSecret = decryptSecret(user.twoFactorSecret);
      isCodeValid = verifyTotpCode(decryptedSecret, cleanCode);
    }

    // 2. Nếu không khớp TOTP, thử kiểm tra Backup Code (xxxx-xxxx)
    if (
      !isCodeValid &&
      user.twoFactorBackupCodes &&
      Array.isArray(user.twoFactorBackupCodes)
    ) {
      const formattedCode = cleanCode.toUpperCase();
      const hashedInput = hashToken(formattedCode);
      const backupCodes = user.twoFactorBackupCodes as string[];
      const matchIndex = backupCodes.findIndex((storedHash) => {
        const bufInput = Buffer.from(hashedInput, "utf8");
        const bufStored = Buffer.from(storedHash, "utf8");
        return (
          bufInput.length === bufStored.length &&
          crypto.timingSafeEqual(bufInput, bufStored)
        );
      });

      if (matchIndex !== -1) {
        isCodeValid = true;
        // Single-use: Hủy mã dự phòng đã dùng khỏi danh sách
        const remainingBackupCodes = [...backupCodes];
        remainingBackupCodes.splice(matchIndex, 1);
        await this.repository.updateBackupCodes(user.id, remainingBackupCodes);
      }
    }

    if (!isCodeValid) {
      throw new AppError(
        "Mã xác thực 2FA hoặc mã dự phòng không chính xác",
        400,
        ERROR_CODE.TWO_FACTOR_INVALID_CODE,
      );
    }

    // Cấp Access Token + Refresh Token chính thức
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
    };

    const accessToken = jwt.sign(tokenPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions["expiresIn"],
    });

    const refreshToken = jwt.sign(
      { ...tokenPayload, jti: crypto.randomUUID() },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions["expiresIn"] },
    );

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

    if (metadata?.userAgent) {
      const deviceHash = generateDeviceHash(metadata.userAgent);
      await this.repository.updateUserDeviceLastLogin(
        user.id,
        deviceHash,
        metadata.ipAddress,
      );
    }

    await this.repository.createAuditLog({
      actorId: user.id,
      action: AUDIT_ACTION.VERIFY_2FA_LOGIN,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: user.id,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    const permissions = Array.from(
      await permissionCacheService.getRolePermissions(user.roleId),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
        roleId: user.roleId,
        permissions,
      },
    };
  }

  async disable2FA(
    userId: string,
    data: Disable2FADto,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      currentRefreshToken?: string;
    },
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError(
        "Xác thực 2 bước chưa được kích hoạt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (!user.password) {
      throw new AppError(
        "Tài khoản liên kết mạng xã hội không thể tắt 2FA bằng mật khẩu",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Mật khẩu hiện tại không chính xác",
        400,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const cleanCode = data.code.trim();
    let isCodeValid = false;

    if (/^\d{6}$/.test(cleanCode)) {
      const decryptedSecret = decryptSecret(user.twoFactorSecret);
      isCodeValid = verifyTotpCode(decryptedSecret, cleanCode);
    }

    if (
      !isCodeValid &&
      user.twoFactorBackupCodes &&
      Array.isArray(user.twoFactorBackupCodes)
    ) {
      const formattedCode = cleanCode.toUpperCase();
      const hashedInput = hashToken(formattedCode);
      const backupCodes = user.twoFactorBackupCodes as string[];
      isCodeValid = backupCodes.some((storedHash) => {
        const bufInput = Buffer.from(hashedInput, "utf8");
        const bufStored = Buffer.from(storedHash, "utf8");
        return (
          bufInput.length === bufStored.length &&
          crypto.timingSafeEqual(bufInput, bufStored)
        );
      });
    }

    if (!isCodeValid) {
      throw new AppError(
        "Mã xác thực 2FA hoặc mã dự phòng không chính xác",
        400,
        ERROR_CODE.TWO_FACTOR_INVALID_CODE,
      );
    }

    await this.repository.disable2FA(userId);

    // Cách 1: Thu hồi toàn bộ phiên đăng nhập khác khi tắt 2FA
    await this.repository.revokeOtherSessions(
      userId,
      metadata?.currentRefreshToken,
    );
    permissionCacheService.invalidateUser(userId);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.DISABLE_2FA,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }

  async regenerateBackupCodes(
    userId: string,
    data: RegenerateBackupCodesDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<Enable2FAResponseDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError(
        "Xác thực 2 bước chưa được kích hoạt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (!user.password) {
      throw new AppError(
        "Tài khoản liên kết mạng xã hội không thể tái tạo mã bằng mật khẩu",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Mật khẩu hiện tại không chính xác",
        400,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const cleanCode = data.code.trim();
    let isCodeValid = false;

    if (/^\d{6}$/.test(cleanCode)) {
      const decryptedSecret = decryptSecret(user.twoFactorSecret);
      isCodeValid = verifyTotpCode(decryptedSecret, cleanCode);
    }

    if (
      !isCodeValid &&
      user.twoFactorBackupCodes &&
      Array.isArray(user.twoFactorBackupCodes)
    ) {
      const formattedCode = cleanCode.toUpperCase();
      const hashedInput = hashToken(formattedCode);
      const backupCodes = user.twoFactorBackupCodes as string[];
      isCodeValid = backupCodes.some((storedHash) => {
        const bufInput = Buffer.from(hashedInput, "utf8");
        const bufStored = Buffer.from(storedHash, "utf8");
        return (
          bufInput.length === bufStored.length &&
          crypto.timingSafeEqual(bufInput, bufStored)
        );
      });
    }

    if (!isCodeValid) {
      throw new AppError(
        "Mã xác thực 2FA hoặc mã dự phòng không chính xác",
        400,
        ERROR_CODE.TWO_FACTOR_INVALID_CODE,
      );
    }

    const { plainCodes, hashedCodes } = generateBackupCodes(8);
    await this.repository.updateBackupCodes(userId, hashedCodes);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.REGENERATE_2FA_BACKUP_CODES,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { backupCodes: plainCodes };
  }
}
