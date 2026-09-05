import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepository } from "../auth.repository";
import { AppError } from "../../../common/errors/app-error";
import { ERROR_CODE } from "../../../common/errors/error-code";
import { jwtConfig } from "../../../config/jwt.config";
import {
  Setup2FAResponseDto,
  Enable2FADto,
  Enable2FAResponseDto,
  Verify2FALoginDto,
  LoginResponseDto,
  Disable2FADto,
  RegenerateBackupCodesDto,
} from "../auth.dto";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../../common/constants/audit-log.constant";
import {
  encryptSecret,
  decryptSecret,
  hashToken,
} from "../../../common/helpers/crypto.helper";
import {
  generateTotpSecret,
  generateOtpauthUri,
  verifyTotpCode,
  generateBackupCodes,
} from "../../../common/helpers/totp.helper";
import { generateDeviceHash } from "../../../common/helpers/user-agent.helper";
import { permissionCacheService } from "../../../common/services/permission-cache.service";

export class Auth2FAService {
  constructor(private readonly getRepo: () => AuthRepository) {}

  private get repository(): AuthRepository {
    return this.getRepo();
  }

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
      payload = jwt.verify(data.tempToken, jwtConfig.accessSecret, {
        algorithms: ["HS256"],
      });
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

    if (user.password) {
      if (!data.password) {
        throw new AppError(
          "Mật khẩu hiện tại là bắt buộc",
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

    // Thu hồi toàn bộ phiên đăng nhập khác khi tắt 2FA
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

    if (user.password) {
      if (!data.password) {
        throw new AppError(
          "Mật khẩu hiện tại là bắt buộc",
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
    }

    const cleanCode = data.code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AppError(
        "Cần cung cấp mã TOTP 6 chữ số từ ứng dụng xác thực để tái tạo mã dự phòng",
        400,
        ERROR_CODE.TWO_FACTOR_INVALID_CODE,
      );
    }

    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const isCodeValid = verifyTotpCode(decryptedSecret, cleanCode);

    if (!isCodeValid) {
      throw new AppError(
        "Mã xác thực TOTP không chính xác hoặc đã hết hạn",
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
