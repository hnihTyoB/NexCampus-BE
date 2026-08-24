import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { jwtConfig } from '../../config/jwt.config';
import { r2Config } from '../../config/r2.config';
import { LoginDto, LoginResponseDto, AuthTokensDto, MeDto, RegisterDto, UpdateProfileDto, UpdatePasswordDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, GetAvatarUploadUrlDto, GetAvatarUploadUrlResponseDto, ConfirmAvatarUploadDto } from './auth.dto';
import { MailService } from '../../common/services/mail.service';
import { R2Service } from '../../common/services/r2.service';
import { ROLES } from '../../common/constants/role.constant';
import { NOTIFICATION_TYPE, NOTIFICATION_PRIORITY } from '../../common/constants/notification.constant';
import { notificationDispatcher } from '../../common/services/notification-dispatcher.service';
import { generateDeviceHash, parseUserAgent } from '../../common/helpers/user-agent.helper';
import { permissionCacheService } from '../../common/services/permission-cache.service';

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly mailService = new MailService();
  private readonly r2Service = new R2Service();

  async login(data: LoginDto, metadata?: { userAgent?: string; ipAddress?: string }): Promise<LoginResponseDto> {
    const { email, password } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError('Invalid credentials', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa. Vui lòng xác thực email hoặc liên hệ quản trị viên.', 403, ERROR_CODE.USER_INACTIVE);
    }

    if (!user.password) {
      throw new AppError('Invalid credentials', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    const payload = { id: user.id, email: user.email, role: user.role.name, roleId: user.roleId };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { ...payload, jti: crypto.randomUUID() },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(user.id, refreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    // Track user devices and trigger new device login alert
    if (metadata?.userAgent) {
      const deviceHash = generateDeviceHash(metadata.userAgent);
      const parsedDevice = parseUserAgent(metadata.userAgent);
      
      const existingDevice = await this.repository.findUserDevice(user.id, deviceHash);
      if (!existingDevice) {
        // Create new device and trigger email alert in the background
        await this.repository.upsertUserDevice({
          userId: user.id,
          deviceHash,
          deviceName: parsedDevice,
          ipAddress: metadata.ipAddress,
        });

        if (user.email) {
          // Send email alert asynchronously without blocking login response
          this.mailService.sendNewDeviceAlertEmail(
            user.email,
            {
              deviceName: parsedDevice,
              ipAddress: metadata.ipAddress || 'Không rõ',
              loginTime: new Date(),
            },
            user.fullName || undefined
          ).catch(err => {
            console.error('Failed to send unrecognized device email:', err);
          });
        }

        notificationDispatcher.notify(
          user.id,
          NOTIFICATION_TYPE.ALERT,
          'Phát hiện đăng nhập từ thiết bị mới',
          `Tài khoản của bạn vừa được đăng nhập từ thiết bị: ${parsedDevice} (IP: ${metadata.ipAddress || 'Không rõ'}).`,
          { priority: NOTIFICATION_PRIORITY.HIGH }
        ).catch(err => {
          console.error('Failed to notify unrecognized device in-app:', err);
        });
      } else {
        // Update last login info
        await this.repository.updateUserDeviceLastLogin(user.id, deviceHash, metadata.ipAddress);
      }
    }

    const permissions = Array.from(await permissionCacheService.getRolePermissions(user.roleId));

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

  async refresh(token: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthTokensDto> {
    let payload: any;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (error) {
      throw new AppError('Invalid refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    const savedToken = await this.repository.findRefreshToken(token);
    if (!savedToken) {
      throw new AppError('Invalid or expired refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    if (savedToken.expiresAt < new Date()) {
      await this.repository.deleteRefreshToken(token);
      throw new AppError('Refresh token expired', 401, ERROR_CODE.TOKEN_EXPIRED);
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, ERROR_CODE.USER_INACTIVE);
    }

    const newPayload = { id: user.id, email: user.email, role: user.role.name, roleId: user.roleId };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions['expiresIn'],
    });

    const newRefreshToken = jwt.sign(
      { ...newPayload, jti: crypto.randomUUID() },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.rotateRefreshToken(user.id, token, newRefreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    const result = await this.repository.deleteRefreshToken(token);

    if (result.count === 0) {
      throw new AppError('Refresh token not found or already invalidated', 400, ERROR_CODE.TOKEN_INVALID);
    }
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const permissions = Array.from(await permissionCacheService.getRolePermissions(user.roleId));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      roleId: user.roleId,
      permissions,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async register(data: RegisterDto): Promise<void> {
    const { email, password, fullName } = data;

    const existing = await this.repository.findByEmail(email);
    if (existing) {
      throw new AppError('Email already exists', 400, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const defaultRole = await this.repository.findRoleByName(ROLES.USER);
    if (!defaultRole) {
      throw new AppError('Default role not found', 500, ERROR_CODE.NOT_FOUND);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.repository.registerUserWithVerification({
      email,
      passwordHash,
      fullName,
      roleId: defaultRole.id,
      isActive: false,
    }, token, expiresAt);

    try {
      await this.mailService.sendVerificationEmail(email, token, fullName || undefined);
    } catch (mailErr: any) {
      console.warn(`[AuthService] Failed to send verification email to ${email}:`, mailErr?.message || mailErr);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await this.repository.findVerificationToken(token);

    if (!verificationToken) {
      throw new AppError('Invalid verification token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (verificationToken.expiresAt < new Date()) {
      await this.repository.deleteVerificationToken(verificationToken.id);
      throw new AppError('Verification token has expired', 400, ERROR_CODE.TOKEN_EXPIRED);
    }

    await this.repository.activateUserAndDeleteToken(verificationToken.userId, verificationToken.id);

    notificationDispatcher.notify(
      verificationToken.userId,
      NOTIFICATION_TYPE.SUCCESS,
      'Xác thực tài khoản thành công',
      'Chào mừng bạn đến với hệ thống! Tài khoản của bạn đã được kích hoạt thành công.'
    ).catch(err => console.error('Failed to dispatch welcome notification:', err));
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.phoneNumber) {
      const existingPhone = await this.repository.findByPhone(data.phoneNumber);
      if (existingPhone && existingPhone.id !== userId) {
        throw new AppError('Phone number already exists', 400, ERROR_CODE.DUPLICATE_ENTRY);
      }
    }

    await this.repository.updateProfile(userId, data);

    notificationDispatcher.notify(
      userId,
      NOTIFICATION_TYPE.INFO,
      'Cập nhật thông tin thành công',
      'Hồ sơ cá nhân của bạn đã được cập nhật thành công.'
    ).catch(err => console.error('Failed to dispatch update profile notification:', err));
  }

  async updatePassword(userId: string, data: UpdatePasswordDto): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.password) {
      if (!data.oldPassword) {
        throw new AppError('Old password is required', 400, ERROR_CODE.INVALID_CREDENTIALS);
      }
      const isPasswordValid = await bcrypt.compare(data.oldPassword, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid old password', 401, ERROR_CODE.INVALID_CREDENTIALS);
      }
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.updatePasswordAndRevokeTokens(userId, passwordHash);

    notificationDispatcher.notify(
      userId,
      NOTIFICATION_TYPE.WARNING,
      'Đổi mật khẩu thành công',
      'Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.',
      { priority: NOTIFICATION_PRIORITY.HIGH }
    ).catch(err => console.error('Failed to dispatch password changed notification:', err));
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

    await this.mailService.sendPasswordResetEmail(user.email, token, user.fullName || undefined);
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const resetToken = await this.repository.findPasswordResetToken(data.token);
    if (!resetToken) {
      throw new AppError('Invalid or expired reset token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (resetToken.expiresAt < new Date()) {
      await this.repository.deletePasswordResetToken(resetToken.id);
      throw new AppError('Reset token has expired', 400, ERROR_CODE.TOKEN_EXPIRED);
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.resetPasswordAndRevokeTokens(resetToken.userId, passwordHash, resetToken.id);

    notificationDispatcher.notify(
      resetToken.userId,
      NOTIFICATION_TYPE.WARNING,
      'Đặt lại mật khẩu thành công',
      'Mật khẩu tài khoản của bạn vừa được đặt lại thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.',
      { priority: NOTIFICATION_PRIORITY.HIGH }
    ).catch(err => console.error('Failed to dispatch reset password notification:', err));
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

    await this.mailService.sendVerificationEmail(user.email, token, user.fullName || undefined);
  }

  async getActiveSessions(userId: string, currentToken?: string) {
    const sessions = await this.repository.findSessionsByUserId(userId);
    return sessions.map(session => ({
      id: session.id,
      deviceName: parseUserAgent(session.userAgent || undefined),
      ipAddress: session.ipAddress || 'Không rõ',
      createdAt: session.createdAt,
      isCurrent: currentToken ? session.token === currentToken : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.repository.findSessionById(userId, sessionId);
    if (!session) {
      throw new AppError('Session not found', 404, ERROR_CODE.NOT_FOUND);
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
  async getAvatarUploadUrl(userId: string, data: GetAvatarUploadUrlDto): Promise<GetAvatarUploadUrlResponseDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const ext = data.contentType.split('/')[1] ?? 'webp';
    const key = `avatars/${userId}/${Date.now()}.${ext}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, data.contentType);
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
  async confirmAvatarUpload(userId: string, data: ConfirmAvatarUploadDto): Promise<string> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // Chỉ cho phép key thuộc về chính user này
    const expectedPrefix = `avatars/${userId}/`;
    if (!data.key.startsWith(expectedPrefix)) {
      throw new AppError('Invalid avatar key', 403, ERROR_CODE.FORBIDDEN);
    }

    const newAvatarUrl = this.r2Service.getPublicUrl(data.key);

    // Lấy key cũ từ avatar_url hiện tại trước khi ghi đè
    let oldKey: string | null = null;
    if (user.avatarUrl) {
      const base = r2Config.publicBaseUrl.replace(/\/$/, '');
      if (user.avatarUrl.startsWith(base)) {
        oldKey = user.avatarUrl.slice(base.length + 1); // loại bỏ "base/"
      }
    }

    // Cập nhật avatar_url vào DB
    await this.repository.updateProfile(userId, { avatarUrl: newAvatarUrl });

    notificationDispatcher.notify(
      userId,
      NOTIFICATION_TYPE.INFO,
      'Cập nhật ảnh đại diện thành công',
      'Ảnh đại diện của bạn đã được tải lên và lưu thành công.'
    ).catch(err => console.error('Failed to dispatch avatar notification:', err));

    // Xóa file cũ (thực hiện sau khi DB đã cập nhật thành công)
    if (oldKey && oldKey !== data.key) {
      await this.r2Service.deleteFile(oldKey).catch(() => {
        // Không throw nếu xóa file cũ thất bại — không ảnh hưởng đến flow chính
      });
    }

    return newAvatarUrl;
  }
}
