import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  requestDeactivateSchema,
  confirmDeactivateSchema,
} from "../src/modules/auth/auth.validation";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthRepository } from "../src/modules/auth/auth.repository";
import { MailService } from "../src/common/services/mail.service";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { ROLES } from "../src/common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { AppError } from "../src/common/errors/app-error";
import { swaggerSpec } from "../src/config/swagger.config";

describe("Auth Deactivation Test Suite (GDPR Self-Deactivation)", () => {
  let authService: AuthService;
  let mockRepository: Partial<AuthRepository>;
  let mockMailService: Partial<MailService>;
  let dispatchedEmails: Array<{
    email: string;
    token: string;
    fullName?: string;
  }> = [];
  let auditLogs: Array<any> = [];

  beforeEach(() => {
    dispatchedEmails = [];
    auditLogs = [];
    permissionCacheService.clear();

    mockRepository = {
      findById: async (id: string) => {
        if (id === "user-active-1") {
          return {
            id: "user-active-1",
            email: "user1@example.com",
            password: await bcrypt.hash("Password@123", 10),
            fullName: "Nguyen Van A",
            phoneNumber: null,
            avatarUrl: null,
            isActive: true,
            deletedAt: null,
            deletedBy: null,
            roleId: "role-user-id",
            role: {
              id: "role-user-id",
              name: ROLES.USER,
              description: null,
              isSystem: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        if (id === "admin-sole-1") {
          return {
            id: "admin-sole-1",
            email: "admin@example.com",
            password: await bcrypt.hash("Admin@123", 10),
            fullName: "Sole Admin",
            phoneNumber: null,
            avatarUrl: null,
            isActive: true,
            deletedAt: null,
            deletedBy: null,
            roleId: "role-admin-id",
            role: {
              id: "role-admin-id",
              name: ROLES.ADMIN,
              description: null,
              isSystem: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        if (id === "user-inactive-1") {
          return {
            id: "user-inactive-1",
            email: "inactive@example.com",
            password: await bcrypt.hash("Password@123", 10),
            fullName: "Inactive User",
            phoneNumber: null,
            avatarUrl: null,
            isActive: false,
            deletedAt: new Date(),
            deletedBy: "admin",
            roleId: "role-user-id",
            role: {
              id: "role-user-id",
              name: ROLES.USER,
              description: null,
              isSystem: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        if (id === "user-social-1") {
          return {
            id: "user-social-1",
            email: "social@example.com",
            password: null, // Social user without password
            fullName: "Social User",
            phoneNumber: null,
            avatarUrl: null,
            isActive: true,
            deletedAt: null,
            deletedBy: null,
            roleId: "role-user-id",
            role: {
              id: "role-user-id",
              name: ROLES.USER,
              description: null,
              isSystem: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        return null;
      },
      countActiveAdmins: async () => 1,
      createDeactivationToken: async (
        userId: string,
        token: string,
        expiresAt: Date,
      ) =>
        ({
          id: "token-uuid-1",
          token,
          userId,
          expiresAt,
          createdAt: new Date(),
        }) as any,
      findDeactivationToken: async (token: string) => {
        if (token === "valid-token") {
          return {
            id: "token-uuid-1",
            token,
            userId: "user-active-1",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10m in the future
            user: {
              id: "user-active-1",
              role: { name: ROLES.USER },
            },
          } as any;
        }
        if (token === "expired-token") {
          return {
            id: "token-uuid-expired",
            token,
            userId: "user-active-1",
            expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5m in the past
            user: {
              id: "user-active-1",
              role: { name: ROLES.USER },
            },
          } as any;
        }
        if (token === "sole-admin-token") {
          return {
            id: "token-uuid-admin",
            token,
            userId: "admin-sole-1",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            user: {
              id: "admin-sole-1",
              role: { name: ROLES.ADMIN },
            },
          } as any;
        }
        return null;
      },
      deleteVerificationToken: async () => ({}) as any,
      deactivateUserAndRevokeSessions: async () => ({}) as any,
      createAuditLog: async (data: any) => {
        auditLogs.push(data);
        return data as any;
      },
    };

    mockMailService = {
      sendAccountDeactivationEmail: async (
        email: string,
        token: string,
        fullName?: string,
      ) => {
        dispatchedEmails.push({ email, token, fullName });
      },
    };

    authService = new AuthService();
    (authService as any).repository = mockRepository;
    (authService as any).mailService = mockMailService;
  });

  describe("1. Zod Validation Schemas", () => {
    it("requestDeactivateSchema requires password and accepts optional reason", () => {
      const valid = {
        password: "Password@123",
        reason: "Tôi muốn đổi sang dịch vụ khác",
      };
      assert.equal(requestDeactivateSchema.safeParse(valid).success, true);

      const validWithoutReason = { password: "Password@123" };
      assert.equal(
        requestDeactivateSchema.safeParse(validWithoutReason).success,
        true,
      );

      const missingPassword = { reason: "No pass" };
      assert.equal(
        requestDeactivateSchema.safeParse(missingPassword).success,
        false,
      );

      const tooLongReason = { password: "pass", reason: "a".repeat(501) };
      assert.equal(
        requestDeactivateSchema.safeParse(tooLongReason).success,
        false,
      );
    });

    it("confirmDeactivateSchema requires token", () => {
      assert.equal(
        confirmDeactivateSchema.safeParse({ token: "abc-123" }).success,
        true,
      );
      assert.equal(
        confirmDeactivateSchema.safeParse({ token: "" }).success,
        false,
      );
      assert.equal(confirmDeactivateSchema.safeParse({}).success, false);
    });
  });

  describe("2. Request Deactivation Flow (POST /auth/deactivate/request)", () => {
    it("should reject if wrong password is provided", async () => {
      await assert.rejects(
        authService.requestDeactivate("user-active-1", {
          password: "WrongPassword!",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_CREDENTIALS);
          return true;
        },
      );
      assert.equal(dispatchedEmails.length, 0);
    });

    it("should reject if user account is already inactive or soft-deleted", async () => {
      await assert.rejects(
        authService.requestDeactivate("user-inactive-1", {
          password: "Password@123",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.USER_INACTIVE);
          return true;
        },
      );
    });

    it("should reject if user is a social user without password", async () => {
      await assert.rejects(
        authService.requestDeactivate("user-social-1", {
          password: "AnyPassword",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          return true;
        },
      );
    });

    it("should prevent deactivation if user is the sole active ADMIN (Anti-lockout)", async () => {
      await assert.rejects(
        authService.requestDeactivate("admin-sole-1", {
          password: "Admin@123",
        }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          assert.match(err.message, /Quản trị viên duy nhất/);
          return true;
        },
      );
      assert.equal(dispatchedEmails.length, 0);
    });

    it("should successfully generate token, dispatch email and log audit when password matches", async () => {
      let createdToken = "";
      mockRepository.createDeactivationToken = async (
        userId: string,
        token: string,
        expiresAt: Date,
      ) => {
        createdToken = token;
        const ttlMs = expiresAt.getTime() - Date.now();
        assert.ok(
          ttlMs > 14 * 60 * 1000 && ttlMs <= 15 * 60 * 1000,
          "Expiry should be 15 minutes",
        );
        return {} as any;
      };

      await authService.requestDeactivate(
        "user-active-1",
        { password: "Password@123", reason: "Tạm nghỉ" },
        { ipAddress: "127.0.0.1", userAgent: "Mocha" },
      );

      assert.equal(dispatchedEmails.length, 1);
      assert.equal(dispatchedEmails[0].email, "user1@example.com");
      assert.equal(dispatchedEmails[0].token, createdToken);
      assert.equal(dispatchedEmails[0].fullName, "Nguyen Van A");

      assert.equal(auditLogs.length, 1);
      assert.equal(
        auditLogs[0].action,
        AUDIT_ACTION.REQUEST_ACCOUNT_DEACTIVATION,
      );
      assert.equal(auditLogs[0].targetType, AUDIT_TARGET_TYPE.USER);
      assert.equal(auditLogs[0].targetId, "user-active-1");
      assert.equal(auditLogs[0].details.reason, "Tạm nghỉ");
    });
  });

  describe("3. Confirm Deactivation Flow (POST /auth/deactivate/confirm)", () => {
    it("should reject invalid or non-existent token with 400 TOKEN_INVALID", async () => {
      await assert.rejects(
        authService.confirmDeactivate({ token: "invalid-non-existent" }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.TOKEN_INVALID);
          return true;
        },
      );
    });

    it("should reject expired token with 400 TOKEN_EXPIRED and clean it up", async () => {
      let deletedTokenId = "";
      mockRepository.deleteVerificationToken = async (tokenId: string) => {
        deletedTokenId = tokenId;
        return {} as any;
      };

      await assert.rejects(
        authService.confirmDeactivate({ token: "expired-token" }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.TOKEN_EXPIRED);
          return true;
        },
      );
      assert.equal(deletedTokenId, "token-uuid-expired");
    });

    it("should block deactivation of sole active ADMIN at confirm step (Double Guard)", async () => {
      await assert.rejects(
        authService.confirmDeactivate({ token: "sole-admin-token" }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should successfully deactivate user, revoke all sessions, invalidate cache and record audit log", async () => {
      let deactivatedUserId = "";
      let deactivatedTokenId = "";
      mockRepository.deactivateUserAndRevokeSessions = async (
        userId: string,
        tokenId: string,
      ) => {
        deactivatedUserId = userId;
        deactivatedTokenId = tokenId;
        return {} as any;
      };

      // Set user in cache to verify cache invalidation
      (permissionCacheService as any).userCache.set("user-active-1", {
        user: {
          id: "user-active-1",
          isActive: true,
          deletedAt: null,
          roleId: "role-user-id",
          roleName: ROLES.USER,
        },
        expiresAt: Date.now() + 60000,
      });

      await authService.confirmDeactivate(
        { token: "valid-token" },
        { ipAddress: "192.168.1.5", userAgent: "MobileClient" },
      );

      assert.equal(deactivatedUserId, "user-active-1");
      assert.equal(deactivatedTokenId, "token-uuid-1");

      // Cache should be evicted immediately
      assert.equal(
        (permissionCacheService as any).userCache.has("user-active-1"),
        false,
      );

      // Audit log should be created
      assert.equal(auditLogs.length, 1);
      assert.equal(
        auditLogs[0].action,
        AUDIT_ACTION.CONFIRM_ACCOUNT_DEACTIVATION,
      );
      assert.equal(auditLogs[0].targetId, "user-active-1");
      assert.equal(auditLogs[0].ipAddress, "192.168.1.5");
    });

    it("should reject confirmDeactivate if user is already inactive or soft-deleted", async () => {
      mockRepository.findDeactivationToken = async (token: string) =>
        ({
          id: "token-uuid-inactive",
          token,
          userId: "user-inactive-1",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          user: {
            id: "user-inactive-1",
            isActive: false,
            deletedAt: new Date(),
            role: { name: ROLES.USER },
          },
        }) as any;

      await assert.rejects(
        authService.confirmDeactivate({ token: "token-inactive-user" }),
        (err: any) => {
          assert.equal(err instanceof AppError, true);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          return true;
        },
      );
    });
  });

  describe("4. OpenAPI Documentation Registration", () => {
    it("should register /auth/deactivate/request and /auth/deactivate/confirm in OpenAPI specification", () => {
      assert.ok(
        swaggerSpec.paths["/auth/deactivate/request"],
        "Endpoint /auth/deactivate/request must be registered",
      );
      assert.ok(
        swaggerSpec.paths["/auth/deactivate/request"].post,
        "POST /auth/deactivate/request must exist",
      );
      assert.equal(
        swaggerSpec.paths["/auth/deactivate/request"].post.tags[0],
        "Auth",
      );

      assert.ok(
        swaggerSpec.paths["/auth/deactivate/confirm"],
        "Endpoint /auth/deactivate/confirm must be registered",
      );
      assert.ok(
        swaggerSpec.paths["/auth/deactivate/confirm"].post,
        "POST /auth/deactivate/confirm must exist",
      );
      assert.equal(
        swaggerSpec.paths["/auth/deactivate/confirm"].post.tags[0],
        "Auth",
      );
    });
  });
});
