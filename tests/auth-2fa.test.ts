import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthRepository } from "../src/modules/auth/auth.repository";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { ROLES } from "../src/common/constants/role.constant";
import { AUDIT_ACTION } from "../src/common/constants/audit-log.constant";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { AppError } from "../src/common/errors/app-error";
import { jwtConfig } from "../src/config/jwt.config";
import {
  generateTotpSecret,
  generateTotpCode,
  generateBackupCodes,
} from "../src/common/helpers/totp.helper";
import { encryptSecret, hashToken } from "../src/common/helpers/crypto.helper";
import { swaggerSpec } from "../src/config/swagger.config";
import {
  enable2FASchema,
  verify2FALoginSchema,
  disable2FASchema,
  regenerateBackupCodesSchema,
} from "../src/modules/auth/auth.validation";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../src/middlewares/auth.middleware";

describe("Two-Factor Authentication (2FA / TOTP) Test Suite", () => {
  let authService: AuthService;
  let mockRepository: Partial<AuthRepository>;
  let auditLogs: Array<any> = [];
  let revokedSessionsHistory: Array<{ userId: string; currentToken?: string }> =
    [];

  const rawSecret = "JBSWY3DPEHPK3PXP"; // Standard Base32 key
  const encryptedSecret = encryptSecret(rawSecret);
  const { plainCodes, hashedCodes } = generateBackupCodes(8);

  let mockUser: any;

  beforeEach(async () => {
    auditLogs = [];
    revokedSessionsHistory = [];
    permissionCacheService.clear();

    const roleId = "a0000000-0000-0000-0000-000000000001";
    (permissionCacheService as any).cache.set(roleId, {
      permissions: new Set(["USER_READ", "USER_UPDATE"]),
      expiresAt: Date.now() + 600000,
    });
    (permissionCacheService as any).userCache.set("user-2fa-1", {
      user: {
        id: "user-2fa-1",
        isActive: true,
        deletedAt: null,
        roleId,
        roleName: ROLES.USER,
      },
      expiresAt: Date.now() + 600000,
    });

    mockUser = {
      id: "user-2fa-1",
      email: "user2fa@example.com",
      password: await bcrypt.hash("Password@123", 10),
      fullName: "User TwoFactor",
      phoneNumber: null,
      avatarUrl: null,
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      deletedAt: null,
      deletedBy: null,
      roleId,
      role: {
        id: roleId,
        name: ROLES.USER,
        description: null,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepository = {
      findById: async (id: string) => {
        if (id === mockUser.id) return mockUser;
        return null;
      },
      findByEmail: async (email: string) => {
        if (email === mockUser.email) return mockUser;
        return null;
      },
      enable2FA: async (
        userId: string,
        secretEnc: string,
        backupHashed: string[],
      ) => {
        mockUser.twoFactorEnabled = true;
        mockUser.twoFactorSecret = secretEnc;
        mockUser.twoFactorBackupCodes = backupHashed;
        return mockUser;
      },
      disable2FA: async (userId: string) => {
        mockUser.twoFactorEnabled = false;
        mockUser.twoFactorSecret = null;
        mockUser.twoFactorBackupCodes = null;
        return mockUser;
      },
      updateBackupCodes: async (userId: string, backupHashed: string[]) => {
        mockUser.twoFactorBackupCodes = backupHashed;
        return mockUser;
      },
      revokeOtherSessions: async (userId: string, currentToken?: string) => {
        revokedSessionsHistory.push({ userId, currentToken });
        return { count: 1 } as any;
      },
      saveRefreshToken: async () => ({}) as any,
      updateUserDeviceLastLogin: async () => ({}) as any,
      createAuditLog: async (data: any) => {
        auditLogs.push(data);
        return data as any;
      },
    };

    authService = new AuthService();
    (authService as any).repository = mockRepository;
  });

  describe("1. Zod Validation Schemas for 2FA", () => {
    it("enable2FASchema requires secret (min 16 chars) and 6-digit code", () => {
      assert.equal(
        enable2FASchema.safeParse({ secret: rawSecret, code: "123456" })
          .success,
        true,
      );
      assert.equal(
        enable2FASchema.safeParse({ secret: "short", code: "123456" }).success,
        false,
      );
      assert.equal(
        enable2FASchema.safeParse({ secret: rawSecret, code: "12345" }).success,
        false,
      );
      assert.equal(
        enable2FASchema.safeParse({ secret: rawSecret, code: "abcdef" })
          .success,
        false,
      );
    });

    it("verify2FALoginSchema requires tempToken and code", () => {
      assert.equal(
        verify2FALoginSchema.safeParse({ tempToken: "token", code: "123456" })
          .success,
        true,
      );
      assert.equal(
        verify2FALoginSchema.safeParse({
          tempToken: "token",
          code: "A1B2-C3D4",
        }).success,
        true,
      );
      assert.equal(
        verify2FALoginSchema.safeParse({ tempToken: "", code: "123456" })
          .success,
        false,
      );
    });

    it("disable2FASchema requires password and code", () => {
      assert.equal(
        disable2FASchema.safeParse({ password: "Password@123", code: "123456" })
          .success,
        true,
      );
      assert.equal(
        disable2FASchema.safeParse({ password: "", code: "123456" }).success,
        false,
      );
    });

    it("regenerateBackupCodesSchema requires password and 6-digit TOTP code, rejecting static backup codes", () => {
      assert.equal(
        regenerateBackupCodesSchema.safeParse({
          password: "Password@123",
          code: "123456",
        }).success,
        true,
      );
      assert.equal(
        regenerateBackupCodesSchema.safeParse({
          password: "Password@123",
          code: "A1B2-C3D4",
        }).success,
        false,
      );
    });
  });

  describe("2. Setup & Enable 2FA Flow", () => {
    it("setup2FA should return a Base32 secret and otpauthUrl", async () => {
      const result = await authService.setup2FA(mockUser.id);
      assert.equal(typeof result.secret, "string");
      assert.ok(result.secret.length >= 16);
      assert.ok(result.otpauthUrl.startsWith("otpauth://totp/TemplateBE:"));
    });

    it("setup2FA should reject if 2FA is already enabled", async () => {
      mockUser.twoFactorEnabled = true;
      await assert.rejects(authService.setup2FA(mockUser.id), (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.code, ERROR_CODE.TWO_FACTOR_ALREADY_ENABLED);
        return true;
      });
    });

    it("enable2FA should reject if TOTP code is incorrect", async () => {
      await assert.rejects(
        authService.enable2FA(mockUser.id, {
          secret: rawSecret,
          code: "000000",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.TWO_FACTOR_INVALID_CODE);
          return true;
        },
      );
      assert.equal(mockUser.twoFactorEnabled, false);
    });

    it("enable2FA should succeed with valid TOTP code, return 8 backup codes, and revoke other sessions", async () => {
      const validCode = generateTotpCode(rawSecret);
      const result = await authService.enable2FA(mockUser.id, {
        secret: rawSecret,
        code: validCode,
      });

      assert.equal(mockUser.twoFactorEnabled, true);
      assert.ok(mockUser.twoFactorSecret);
      assert.equal(result.backupCodes.length, 8);

      // Verify that other sessions were revoked (Cách 1)
      assert.equal(revokedSessionsHistory.length, 1);
      assert.equal(revokedSessionsHistory[0].userId, mockUser.id);

      assert.equal(auditLogs.length, 1);
      assert.equal(auditLogs[0].action, AUDIT_ACTION.ENABLE_2FA);
    });
  });

  describe("3. Login Challenge Flow with 2FA Enabled", () => {
    beforeEach(() => {
      mockUser.twoFactorEnabled = true;
      mockUser.twoFactorSecret = encryptedSecret;
      mockUser.twoFactorBackupCodes = [...hashedCodes];
    });

    it("login should return requires2FA: true and tempToken when 2FA is enabled", async () => {
      const result = await authService.login({
        email: mockUser.email,
        password: "Password@123",
      });

      assert.equal(result.requires2FA, true);
      assert.ok(result.tempToken);
      assert.equal(result.accessToken, undefined);

      // Verify tempToken structure
      const payload = jwt.verify(
        result.tempToken,
        jwtConfig.accessSecret,
      ) as any;
      assert.equal(payload.id, mockUser.id);
      assert.equal(payload.purpose, "2FA_VERIFICATION");
    });

    it("verify2FALogin should reject invalid or expired tempToken", async () => {
      await assert.rejects(
        authService.verify2FALogin({
          tempToken: "invalid.jwt.token",
          code: "123456",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it("verify2FALogin should reject wrong TOTP code", async () => {
      const tempToken = jwt.sign(
        { id: mockUser.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );

      await assert.rejects(
        authService.verify2FALogin({ tempToken, code: "000000" }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.TWO_FACTOR_INVALID_CODE);
          return true;
        },
      );
    });

    it("verify2FALogin should succeed with valid 6-digit TOTP code and issue tokens", async () => {
      const tempToken = jwt.sign(
        { id: mockUser.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );
      const validCode = generateTotpCode(rawSecret);

      const result = await authService.verify2FALogin({
        tempToken,
        code: validCode,
      });

      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
      assert.equal(result.user?.id, mockUser.id);

      assert.equal(auditLogs.length, 1);
      assert.equal(auditLogs[0].action, AUDIT_ACTION.VERIFY_2FA_LOGIN);
    });

    it("verify2FALogin should succeed with valid Backup Code and consume it (Single-use)", async () => {
      const tempToken = jwt.sign(
        { id: mockUser.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );
      const backupCodeToUse = plainCodes[0]; // First code

      const result = await authService.verify2FALogin({
        tempToken,
        code: backupCodeToUse,
      });
      assert.ok(result.accessToken);

      // Ensure that backup code was removed from user's remaining codes
      assert.equal(mockUser.twoFactorBackupCodes.length, 7);
      const usedCodeHash = hashToken(backupCodeToUse);
      assert.equal(mockUser.twoFactorBackupCodes.includes(usedCodeHash), false);

      // Attempt to reuse the same backup code must fail!
      const secondTempToken = jwt.sign(
        { id: mockUser.id, purpose: "2FA_VERIFICATION" },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );
      await assert.rejects(
        authService.verify2FALogin({
          tempToken: secondTempToken,
          code: backupCodeToUse,
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.TWO_FACTOR_INVALID_CODE);
          return true;
        },
      );
    });
  });

  describe("4. Disable 2FA & Regenerate Backup Codes", () => {
    beforeEach(() => {
      mockUser.twoFactorEnabled = true;
      mockUser.twoFactorSecret = encryptedSecret;
      mockUser.twoFactorBackupCodes = [...hashedCodes];
    });

    it("disable2FA should reject if password is wrong", async () => {
      const validCode = generateTotpCode(rawSecret);
      await assert.rejects(
        authService.disable2FA(mockUser.id, {
          password: "WrongPassword!",
          code: validCode,
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.INVALID_CREDENTIALS);
          return true;
        },
      );
      assert.equal(mockUser.twoFactorEnabled, true);
    });

    it("disable2FA should succeed with valid password and TOTP code, and revoke other sessions", async () => {
      const validCode = generateTotpCode(rawSecret);
      await authService.disable2FA(mockUser.id, {
        password: "Password@123",
        code: validCode,
      });

      assert.equal(mockUser.twoFactorEnabled, false);
      assert.equal(mockUser.twoFactorSecret, null);
      assert.equal(mockUser.twoFactorBackupCodes, null);

      // Verify that other sessions were revoked (Cách 1)
      assert.equal(revokedSessionsHistory.length, 1);
      assert.equal(revokedSessionsHistory[0].userId, mockUser.id);

      assert.equal(auditLogs.length, 1);
      assert.equal(auditLogs[0].action, AUDIT_ACTION.DISABLE_2FA);
    });

    it("disable2FA should succeed with valid password and backup code, and consume the backup code", async () => {
      mockUser.twoFactorEnabled = true;
      mockUser.twoFactorSecret = encryptedSecret;
      mockUser.twoFactorBackupCodes = [...hashedCodes];

      let updatedBackupCodesCall: string[] | null = null;
      mockRepository.updateBackupCodes = async (userId: string, backupHashed: string[]) => {
        updatedBackupCodesCall = backupHashed;
        mockUser.twoFactorBackupCodes = backupHashed;
        return mockUser;
      };

      const backupCodeToUse = plainCodes[0];
      await authService.disable2FA(mockUser.id, {
        password: "Password@123",
        code: backupCodeToUse,
      });

      assert.ok(updatedBackupCodesCall);
      assert.equal((updatedBackupCodesCall as string[]).length, 7);
      assert.equal(mockUser.twoFactorEnabled, false);
      assert.equal(mockUser.twoFactorBackupCodes, null);
    });

    it("regenerateBackupCodes should invalidate old codes and return 8 new codes", async () => {
      const validCode = generateTotpCode(rawSecret);
      const result = await authService.regenerateBackupCodes(mockUser.id, {
        password: "Password@123",
        code: validCode,
      });

      assert.equal(result.backupCodes.length, 8);
      assert.equal(mockUser.twoFactorBackupCodes.length, 8);

      // Old codes should no longer exist
      const oldHash = hashedCodes[0];
      assert.equal(mockUser.twoFactorBackupCodes.includes(oldHash), false);

      assert.equal(auditLogs.length, 1);
      assert.equal(
        auditLogs[0].action,
        AUDIT_ACTION.REGENERATE_2FA_BACKUP_CODES,
      );
    });

    it("regenerateBackupCodes should reject if trying to authenticate using a static backup code", async () => {
      await assert.rejects(
        authService.regenerateBackupCodes(mockUser.id, {
          password: "Password@123",
          code: plainCodes[0],
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.TWO_FACTOR_INVALID_CODE);
          return true;
        },
      );
    });
  });

  describe("5. OpenAPI 3.0 Documentation Registration for 2FA", () => {
    it("should register all 5 2FA endpoints in OpenAPI spec", () => {
      assert.ok(
        swaggerSpec.paths["/auth/2fa/setup"]?.post,
        "POST /auth/2fa/setup must exist",
      );
      assert.ok(
        swaggerSpec.paths["/auth/2fa/enable"]?.post,
        "POST /auth/2fa/enable must exist",
      );
      assert.ok(
        swaggerSpec.paths["/auth/2fa/verify"]?.post,
        "POST /auth/2fa/verify must exist",
      );
      assert.ok(
        swaggerSpec.paths["/auth/2fa/disable"]?.post,
        "POST /auth/2fa/disable must exist",
      );
      assert.ok(
        swaggerSpec.paths["/auth/2fa/backup-codes/regenerate"]?.post,
        "POST /auth/2fa/backup-codes/regenerate must exist",
      );

      assert.equal(
        swaggerSpec.paths["/auth/2fa/setup"].post.tags[0],
        "Auth - 2FA",
      );
    });
  });

  describe("6. 2FA Temp Token Security & Isolation (SEC-01)", () => {
    it("should reject tempToken with 401 UNAUTHORIZED in authMiddleware", async () => {
      const tempToken = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          purpose: "2FA_VERIFICATION",
        },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );

      const req: any = {
        headers: { authorization: `Bearer ${tempToken}` },
        cookies: {},
      };
      let caughtError: any;

      await authMiddleware(req, {} as any, (err?: any) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 401);
      assert.equal(caughtError.code, ERROR_CODE.UNAUTHORIZED);
      assert.equal(req.user, undefined);
    });

    it("should not authenticate user with tempToken in optionalAuthMiddleware", async () => {
      const tempToken = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          purpose: "2FA_VERIFICATION",
        },
        jwtConfig.accessSecret,
        { expiresIn: "5m" },
      );

      const req: any = {
        headers: { authorization: `Bearer ${tempToken}` },
        cookies: {},
      };

      await optionalAuthMiddleware(req, {} as any, () => {});

      assert.equal(req.user, undefined);
    });

    it("should accept valid ACCESS token in authMiddleware", async () => {
      const accessToken = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          role: ROLES.USER,
          roleId: mockUser.roleId,
          purpose: "ACCESS",
        },
        jwtConfig.accessSecret,
        { expiresIn: "15m" },
      );

      const req: any = {
        headers: { authorization: `Bearer ${accessToken}` },
        cookies: {},
      };
      let caughtError: any;

      await authMiddleware(req, {} as any, (err?: any) => {
        caughtError = err;
      });

      assert.equal(caughtError, undefined);
      assert.ok(req.user);
      assert.equal(req.user.id, mockUser.id);
    });
  });
});
