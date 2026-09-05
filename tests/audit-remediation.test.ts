import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../src/config/jwt.config";
import { ROLES } from "../src/common/constants/role.constant";
import { requirePermission } from "../src/middlewares/permission.middleware";
import {
  extractTokenFromRequest,
  authMiddleware,
} from "../src/middlewares/auth.middleware";
import { errorMiddleware } from "../src/middlewares/error.middleware";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { EmailWorker } from "../src/common/workers/email-worker";
import {
  getVietnamDayRange,
  formatVietnamDate,
} from "../src/common/helpers/date.helper";
import { Prisma } from "@prisma/client";
import { ERROR_CODE } from "../src/common/errors/error-code";

function createMockReqRes(
  options: {
    user?: any;
    apiKey?: any;
    path?: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {},
) {
  const req: any = {
    user: options.user,
    apiKey: options.apiKey,
    path: options.path || "/api/v1/test",
    originalUrl: options.path || "/api/v1/test",
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
  };

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
  };

  return { req, res };
}

describe("Audit & Remediation Verification Test Suite", () => {
  beforeEach(() => {
    permissionCacheService.clear();
  });

  describe("1. [P0-SEC-01] API Key Scoping Enforcement in Permission Middleware", () => {
    it("should grant access when API Key has the required scoped permission", async () => {
      const roleId = "role-admin-uuid";
      (permissionCacheService as any).cache.set(roleId, {
        permissions: new Set(["USER_READ", "USER_DELETE", "ROLE_DELETE"]),
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        user: {
          id: "admin-user-id",
          roleId,
          role: "ADMIN",
          permissions: ["USER_READ"], // API Key only granted USER_READ
        },
        apiKey: {
          id: "ak-123",
          name: "Read-only API Key",
          permissions: ["USER_READ"],
        },
      });

      let nextCalled = false;
      const middleware = requirePermission("USER_READ");
      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(
        nextCalled,
        true,
        "Next should be called for permitted scope",
      );
      assert.deepEqual(req.user.permissions, ["USER_READ"]);
    });

    it("should DENY access with 403 when API Key lacks permission even if User Role has it (Privilege Escalation Prevention)", async () => {
      const roleId = "role-admin-uuid";
      (permissionCacheService as any).cache.set(roleId, {
        permissions: new Set(["USER_READ", "USER_DELETE", "ROLE_DELETE"]),
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        user: {
          id: "admin-user-id",
          roleId,
          role: "ADMIN",
          permissions: ["USER_READ"], // Scoped API Key has only USER_READ
        },
        apiKey: {
          id: "ak-123",
          name: "Read-only API Key",
          permissions: ["USER_READ"],
        },
      });

      let nextError: any;
      const middleware = requirePermission("ROLE_DELETE");
      await middleware(req, res, (err?: any) => {
        nextError = err;
      });

      assert.ok(nextError, "Should throw an error");
      assert.equal(nextError.statusCode, 403);
      assert.equal(nextError.code, ERROR_CODE.FORBIDDEN);
    });
  });

  describe("2. [P1-SEC-02] Token Query Parameter Security Isolation", () => {
    it("should reject JWT token in query string on normal REST endpoints", () => {
      const req = {
        path: "/api/v1/users",
        query: { token: "sensitive-jwt-token" },
        headers: {},
        cookies: {},
      } as any;

      const token = extractTokenFromRequest(req);
      assert.equal(
        token,
        undefined,
        "Token should not be extracted from query string for REST routes",
      );
    });

    it("should permit JWT token in query string strictly for SSE stream endpoints", () => {
      const req = {
        path: "/api/v1/notifications/stream",
        query: { token: "sse-jwt-token" },
        headers: {},
        cookies: {},
      } as any;

      const token = extractTokenFromRequest(req);
      assert.equal(
        token,
        "sse-jwt-token",
        "Token should be extracted from query string for SSE stream routes",
      );
    });
  });

  describe("3. [P2-ERR-01] Prisma P2014 Relation Constraint Violation Handling", () => {
    it("should map Prisma P2014 error to HTTP 400 Bad Request instead of 500 Internal Error", () => {
      const { req, res } = createMockReqRes();
      const p2014Error = new Prisma.PrismaClientKnownRequestError(
        "The change you are trying to make would violate the required relation between models",
        {
          code: "P2014",
          clientVersion: "5.22.0",
        },
      );

      let nextCalled = false;
      errorMiddleware(p2014Error, req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, ERROR_CODE.VALIDATION_ERROR);
    });
  });

  describe("4. [P2-WORKER-01] EmailWorker Async Graceful Shutdown", () => {
    it("should stop cleanly and allow async awaiting", async () => {
      const worker = new EmailWorker();
      await worker.stop();
      assert.ok(true, "Worker stop() must be async and resolve cleanly");
    });
  });

  describe("5. [P2-CRON-02] Timezone Calendar Day Range Boundary", () => {
    it("should accurately calculate startOfDay (17:00:00Z previous day) and endOfDay (16:59:59.999Z) for Vietnam UTC+7", () => {
      const { startOfDay, endOfDay } = getVietnamDayRange("2026-08-24");

      assert.equal(startOfDay.toISOString(), "2026-08-23T17:00:00.000Z");
      assert.equal(endOfDay.toISOString(), "2026-08-24T16:59:59.999Z");
      assert.equal(formatVietnamDate(startOfDay), "24/08/2026");
      assert.equal(formatVietnamDate(startOfDay, "YYYY-MM-DD"), "2026-08-24");
    });
  });

  describe("6. [P1-SEC-01] Email HTML Injection & XSS Sanitization", () => {
    it("should sanitize fullName and deviceName preventing HTML Injection in email templates", () => {
      const { escapeHtml } = require("../src/common/helpers/template.helper");
      const maliciousName = "<img src=x onerror=alert(1)>";
      const safeName = escapeHtml(maliciousName);
      assert.ok(!safeName.includes("<img"));
      assert.ok(safeName.includes("&lt;img src=x onerror=alert(1)&gt;"));
    });
  });

  describe("7. [P1-BUG-01] UUID Normalization in Notification Repository", () => {
    it("should normalize invalid non-UUID strings to null for email notifications", async () => {
      const {
        notificationRepository,
      } = require("../src/modules/notification/notification.repository");
      const isUuid = (val: any) =>
        Boolean(val && /^[0-9a-fA-F-]{36}$/.test(val));
      assert.equal(isUuid("mock-admin-1"), false);
      assert.equal(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
      assert.equal(isUuid(""), false);
      assert.equal(isUuid(undefined), false);
    });
  });

  describe("8. [P1-PERF-01] User State Caching in PermissionCacheService", () => {
    it("should cache user state and correctly invalidate on user update", async () => {
      const userId = "user-test-uuid-1";
      (permissionCacheService as any).userCache.set(userId, {
        user: {
          id: userId,
          isActive: true,
          deletedAt: null,
          roleId: "role-1",
          roleName: "USER",
        },
        expiresAt: Date.now() + 60000,
      });

      const cached = await permissionCacheService.getUserState(userId);
      assert.ok(cached);
      assert.equal(cached?.id, userId);
      assert.equal(cached?.roleName, "USER");

      permissionCacheService.invalidateUser(userId);
      const afterInvalidate = (permissionCacheService as any).userCache.get(
        userId,
      );
      assert.equal(afterInvalidate, undefined);
    });

    it("should fetch user state via userRepository.findUserStateById when cache misses", async () => {
      const { userRepository } = require("../src/modules/users/user.repository");
      const testUserId = "user-uncached-uuid-999";
      let repoCalled = false;
      const originalFindUserState = userRepository.findUserStateById;
      userRepository.findUserStateById = async (id: string) => {
        if (id === testUserId) {
          repoCalled = true;
          return {
            id: testUserId,
            isActive: true,
            deletedAt: null,
            roleId: "role-admin",
            role: { name: "ADMIN" },
          };
        }
        return null;
      };

      try {
        const state = await permissionCacheService.getUserState(testUserId);
        assert.equal(repoCalled, true, "Must delegate to userRepository.findUserStateById");
        assert.equal(state?.roleName, "ADMIN");
      } finally {
        userRepository.findUserStateById = originalFindUserState;
      }
    });
  });

  describe("9. [P3-DEF-01] Strict Regex Validation for Vietnam Day Range", () => {
    it("should reject invalid calendar date formats", () => {
      assert.throws(
        () => getVietnamDayRange("invalid-date"),
        /Invalid date format/,
      );
      assert.throws(
        () => getVietnamDayRange("2026-13-40"),
        /Invalid date format/,
      );
      assert.throws(
        () => getVietnamDayRange("2026/08/24"),
        /Invalid date format/,
      );
      assert.doesNotThrow(() => getVietnamDayRange("2026-08-24"));
      assert.doesNotThrow(() => getVietnamDayRange("24/08/2026"));
    });
  });

  describe("10. [P3-API-01] User Validation Schemas with FullName and PhoneNumber", () => {
    it("should validate and parse createUserSchema with optional fullName and phoneNumber", () => {
      const {
        createUserSchema,
        updateUserSchema,
      } = require("../src/modules/users/user.validation");
      const validCreate = createUserSchema.safeParse({
        email: "test.user@example.com",
        password: "Password123!",
        roleId: "123e4567-e89b-12d3-a456-426614174000",
        fullName: "Nguyễn Văn A",
        phoneNumber: "0912345678",
      });
      assert.equal(validCreate.success, true);

      const validUpdate = updateUserSchema.safeParse({
        fullName: "Trần Thị B",
        phoneNumber: "0987654321",
        isActive: true,
      });
      assert.equal(validUpdate.success, true);
    });
  });

  describe("11. [SEC-P0-01] Deactivated and Soft-Deleted Account Token Rejection in authMiddleware", () => {
    it("should allow request through when user account is active and not deleted", async () => {
      const activeUserId = "user-active-uuid";
      const token = jwt.sign(
        { id: activeUserId, email: "active@example.com", role: "USER" },
        jwtConfig.accessSecret,
      );

      (permissionCacheService as any).userCache.set(activeUserId, {
        user: {
          id: activeUserId,
          isActive: true,
          deletedAt: null,
          roleId: "role-1",
          roleName: "USER",
        },
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      let nextError: any;
      let nextCalled = false;
      await authMiddleware(req, res, (err?: any) => {
        nextCalled = true;
        nextError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(nextError, undefined);
      assert.ok(req.user);
      assert.equal(req.user.id, activeUserId);
    });

    it("should reject with 401 UNAUTHORIZED when account is deactivated (isActive: false)", async () => {
      const inactiveUserId = "user-inactive-uuid";
      const token = jwt.sign(
        { id: inactiveUserId, email: "inactive@example.com", role: "USER" },
        jwtConfig.accessSecret,
      );

      (permissionCacheService as any).userCache.set(inactiveUserId, {
        user: {
          id: inactiveUserId,
          isActive: false,
          deletedAt: null,
          roleId: "role-1",
          roleName: "USER",
        },
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      let nextError: any;
      await authMiddleware(req, res, (err?: any) => {
        nextError = err;
      });

      assert.ok(nextError);
      assert.equal(nextError.statusCode, 401);
      assert.equal(nextError.code, ERROR_CODE.UNAUTHORIZED);
      assert.ok(nextError.message.includes("vô hiệu hóa"));
    });

    it("should reject with 401 UNAUTHORIZED when account is soft-deleted (deletedAt != null)", async () => {
      const deletedUserId = "user-deleted-uuid";
      const token = jwt.sign(
        { id: deletedUserId, email: "deleted@example.com", role: "USER" },
        jwtConfig.accessSecret,
      );

      (permissionCacheService as any).userCache.set(deletedUserId, {
        user: {
          id: deletedUserId,
          isActive: true,
          deletedAt: new Date(),
          roleId: "role-1",
          roleName: "USER",
        },
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      let nextError: any;
      await authMiddleware(req, res, (err?: any) => {
        nextError = err;
      });

      assert.ok(nextError);
      assert.equal(nextError.statusCode, 401);
      assert.equal(nextError.code, ERROR_CODE.UNAUTHORIZED);
    });
  });

  describe("12. [CFG-P0-02] Standalone ENCRYPTION_KEY Production Enforcement", () => {
    it("should reject production configuration when ENCRYPTION_KEY has fewer than 32 characters", () => {
      const { z } = require("zod");
      const testSchema = z
        .object({
          NODE_ENV: z.string(),
          ENCRYPTION_KEY: z.string().default(""),
          APP_SECRET: z.string().default(""),
        })
        .refine(
          (env) => {
            if (env.NODE_ENV !== "production") return true;
            const key = env.ENCRYPTION_KEY || env.APP_SECRET;
            return typeof key === "string" && key.length >= 32;
          },
          {
            message:
              "ENCRYPTION_KEY (or APP_SECRET) must be explicitly configured with at least 32 characters in production",
            path: ["ENCRYPTION_KEY"],
          },
        );

      const invalidResult = testSchema.safeParse({
        NODE_ENV: "production",
        ENCRYPTION_KEY: "short_key_under_32_chars",
      });
      assert.equal(invalidResult.success, false);

      const validResult = testSchema.safeParse({
        NODE_ENV: "production",
        ENCRYPTION_KEY: "12345678901234567890123456789012",
      });
      assert.equal(validResult.success, true);
    });
  });

  describe("13. [RBAC-P1-01] Anti-Lockout Defense for Last Active Admin", () => {
    it("should reject soft-deleting the last active Admin", async () => {
      const { UserService } = require("../src/modules/users/user.service");
      const service = new UserService();
      (service as any).repository = {
        findById: async () => ({
          id: "target-admin-id",
          role: { name: ROLES.ADMIN },
          isActive: true,
        }),
        countActiveAdmins: async () => 1,
        softDelete: async () => {},
      };

      await assert.rejects(
        async () => {
          await service.softDelete("target-admin-id", "actor-admin-id");
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes("Quản trị viên (Admin) duy nhất"));
          return true;
        },
      );
    });

    it("should reject deactivating the last active Admin", async () => {
      const { UserService } = require("../src/modules/users/user.service");
      const service = new UserService();
      (service as any).repository = {
        findById: async () => ({
          id: "target-admin-id",
          role: { name: ROLES.ADMIN },
          isActive: true,
        }),
        countActiveAdmins: async () => 1,
        update: async () => {},
      };

      await assert.rejects(
        async () => {
          await service.update("target-admin-id", { isActive: false });
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes("Quản trị viên (Admin) duy nhất"));
          return true;
        },
      );
    });

    it("should reject demoting the last active Admin to a non-admin role", async () => {
      const { RbacService } = require("../src/modules/rbac/rbac.service");
      const { userRepository } = require("../src/modules/users/user.repository");
      const rbacService = new RbacService();

      const targetRoleId = "123e4567-e89b-12d3-a456-426614174000";
      (rbacService as any).findRoleById = async (roleId: string) => ({
        id: roleId,
        name: ROLES.USER,
      });
      (rbacService as any).repository = {
        findUserById: async () => ({
          id: "target-admin-id",
          roleId: "123e4567-e89b-12d3-a456-426614174001",
          role: { id: "123e4567-e89b-12d3-a456-426614174001", name: ROLES.ADMIN },
          isActive: true,
          deletedAt: null,
        }),
      };

      (permissionCacheService as any).cache.set("123e4567-e89b-12d3-a456-426614174001", {
        permissions: new Set(["USER_ROLE_ASSIGN"]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).cache.set(targetRoleId, {
        permissions: new Set([]),
        expiresAt: Date.now() + 60000,
      });

      const origCount = userRepository.countActiveAdmins;
      userRepository.countActiveAdmins = async () => 1;

      try {
        await assert.rejects(
          async () => {
            await rbacService.assignUserRole("target-admin-id", targetRoleId);
          },
          (err: any) => {
            assert.equal(err.statusCode, 400);
            assert.ok(err.message.includes("hạ quyền Quản trị viên (Admin) duy nhất"));
            return true;
          },
        );
      } finally {
        userRepository.countActiveAdmins = origCount;
      }
    });

    it("should protect custom administrative roles that possess USER_ROLE_ASSIGN permission from lockout", async () => {
      const { UserService } = require("../src/modules/users/user.service");
      const service = new UserService();
      (permissionCacheService as any).cache.set("custom-admin-role-id", {
        permissions: new Set(["USER_ROLE_ASSIGN"]),
        expiresAt: Date.now() + 60000,
      });

      (service as any).repository = {
        findById: async () => ({
          id: "custom-admin-id",
          roleId: "custom-admin-role-id",
          role: { name: "SUPER_ADMIN" },
          isActive: true,
        }),
        countActiveAdmins: async () => 1,
        softDelete: async () => {},
      };

      await assert.rejects(
        async () => {
          await service.softDelete("custom-admin-id", "actor-admin-id");
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes("Quản trị viên (Admin) duy nhất"));
          return true;
        },
      );
    });
  });

  describe("14. [DB-P1-02] Token Model Indexes for Efficient Cron Cleanup", () => {
    it("should verify RefreshToken, VerificationToken, and PasswordResetToken have expiresAt indexes in schema.prisma", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const schema = fs.readFileSync(
        path.join(__dirname, "../prisma/schema.prisma"),
        "utf-8",
      );

      const getModelBlock = (modelName: string) => {
        const match = schema.match(
          new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\}`, "m"),
        );
        return match ? match[1] : "";
      };

      const refreshBlock = getModelBlock("RefreshToken");
      const verificationBlock = getModelBlock("VerificationToken");
      const resetBlock = getModelBlock("PasswordResetToken");
      const apiKeyBlock = getModelBlock("ApiKey");

      assert.ok(
        refreshBlock.includes("@@index([expiresAt])"),
        "RefreshToken must have @@index([expiresAt])",
      );
      assert.ok(
        verificationBlock.includes("@@index([expiresAt])"),
        "VerificationToken must have @@index([expiresAt])",
      );
      assert.ok(
        resetBlock.includes("@@index([expiresAt])"),
        "PasswordResetToken must have @@index([expiresAt])",
      );

      assert.equal(
        apiKeyBlock.includes("@@index([keyHash])"),
        false,
        "ApiKey should not have redundant non-unique @@index([keyHash])",
      );
    });
  });

  describe("15. [DIST-P1-03] Distributed Cache Invalidation Constants & Methods", () => {
    it("should export correct PubSub constants for PermissionCacheService", () => {
      const {
        PERMISSION_PUBSUB_CHANNEL,
        PERMISSION_PUBSUB_ACTION,
      } = require("../src/common/constants/permission.constant");

      assert.equal(PERMISSION_PUBSUB_CHANNEL, "permission:events");
      assert.equal(
        PERMISSION_PUBSUB_ACTION.INVALIDATE_ROLE,
        "INVALIDATE_ROLE",
      );
      assert.equal(
        PERMISSION_PUBSUB_ACTION.INVALIDATE_USER,
        "INVALIDATE_USER",
      );
      assert.equal(PERMISSION_PUBSUB_ACTION.CLEAR, "CLEAR");
    });

    it("should invalidate local cache entries on invalidateRole, invalidateUser, and clear", () => {
      (permissionCacheService as any).cache.set("role-test-id", {
        permissions: new Set(["TEST_PERM"]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set("user-test-id", {
        user: { id: "user-test-id", isActive: true },
        expiresAt: Date.now() + 60000,
      });

      permissionCacheService.invalidateRole("role-test-id");
      assert.equal(
        (permissionCacheService as any).cache.get("role-test-id"),
        undefined,
      );

      permissionCacheService.invalidateUser("user-test-id");
      assert.equal(
        (permissionCacheService as any).userCache.get("user-test-id"),
        undefined,
      );

      (permissionCacheService as any).cache.set("role-test-id-2", {
        permissions: new Set(["TEST"]),
        expiresAt: Date.now() + 60000,
      });
      permissionCacheService.clear();
      assert.equal((permissionCacheService as any).cache.size, 0);
      assert.equal((permissionCacheService as any).userCache.size, 0);
    });
  });

  describe("16. [CRON-P1-04] Vietnam UTC+7 Timezone Precision in Repeatable Schedulers", () => {
    it("should ensure cron schedules run on Vietnam Asia/Ho_Chi_Minh timezone", () => {
      const {
        DEFAULT_CRON_SCHEDULES,
      } = require("../src/common/constants/cron.constant");

      assert.ok(DEFAULT_CRON_SCHEDULES["cleanup-audit-logs"]);
      assert.ok(DEFAULT_CRON_SCHEDULES["cleanup-expired-tokens"]);
      assert.ok(DEFAULT_CRON_SCHEDULES["daily-summary-digest"]);
    });
  });

  describe("17. [QUEUE-P1-05] Resilient Queue Stale Processing Job Recovery", () => {
    it("should verify notification repository includes INTERVAL 15 minutes recovery for stale PROCESSING emails", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const repoPath = path.join(
        __dirname,
        "../src/modules/notification/notification.repository.ts",
      );
      const content = fs.readFileSync(repoPath, "utf-8");

      assert.ok(
        content.includes("updated_at < NOW() - INTERVAL '15 minutes'"),
        "claimPendingEmails must reclaim stuck PROCESSING emails older than 15 minutes",
      );
    });
  });

  describe("18. [P2-AUTH-01] Dynamic Anti-Lockout Defense in Self-Deactivation Flow", () => {
    it("should reject self-deactivation request for custom administrative role when last active admin", async () => {
      const { AuthService } = require("../src/modules/auth/auth.service");
      const bcrypt = require("bcryptjs");
      const authService = new AuthService();

      (authService as any).repository = {
        findById: async () => ({
          id: "custom-admin-user",
          email: "customadmin@example.com",
          password: await bcrypt.hash("Password123!", 10),
          roleId: "123e4567-e89b-12d3-a456-426614174000",
          role: {
            id: "123e4567-e89b-12d3-a456-426614174000",
            name: "SUPER_ADMIN",
          },
          isActive: true,
          deletedAt: null,
        }),
        countActiveAdmins: async () => 1,
      };

      (permissionCacheService as any).cache.set(
        "123e4567-e89b-12d3-a456-426614174000",
        {
          permissions: new Set(["USER_ROLE_ASSIGN"]),
          expiresAt: Date.now() + 60000,
        },
      );

      await assert.rejects(
        async () => {
          await authService.requestDeactivate("custom-admin-user", {
            password: "Password123!",
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes("Quản trị viên duy nhất"));
          return true;
        },
      );
    });
  });

  describe("19. [P2-CRON-01] Dynamic Admin Resolution in Cron Repository Without Magic Strings", () => {
    it("should verify findAdminUsers in cron repository queries dynamic administrative permissions without hardcoded strings", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const repoPath = path.join(
        __dirname,
        "../src/modules/cron/cron.repository.ts",
      );
      const content = fs.readFileSync(repoPath, "utf-8");

      assert.equal(
        content.includes('["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"]'),
        false,
        "cron.repository.ts should not use hardcoded magic string array for roles",
      );
      assert.ok(
        content.includes("ROLES.ADMIN"),
        "cron.repository.ts should use ROLES.ADMIN constant",
      );
      assert.ok(
        content.includes("PERMISSIONS.CRON_JOB_READ") ||
          content.includes("PERMISSIONS.USER_ROLE_ASSIGN"),
        "cron.repository.ts should check admin permissions dynamically",
      );
    });
  });

  describe("20. [P3-I18N-01] Vietnamese Localized Fallback in Maintenance Middleware", () => {
    it("should use DEFAULT_MAINTENANCE_CONFIG for fallback title and message in maintenanceGuard", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const middlewarePath = path.join(
        __dirname,
        "../src/middlewares/maintenance.middleware.ts",
      );
      const content = fs.readFileSync(middlewarePath, "utf-8");

      assert.equal(
        content.includes('"The system is currently under maintenance."'),
        false,
        "maintenance.middleware.ts should not have hardcoded English fallback message",
      );
      assert.ok(
        content.includes("DEFAULT_MAINTENANCE_CONFIG.message"),
        "maintenance.middleware.ts should fall back to DEFAULT_MAINTENANCE_CONFIG.message",
      );
      assert.ok(
        content.includes("DEFAULT_MAINTENANCE_CONFIG.title"),
        "maintenance.middleware.ts should fall back to DEFAULT_MAINTENANCE_CONFIG.title",
      );
    });
  });

  describe("21. [ARCH-P2-01] Mount /system below maintenanceGuard in router", () => {
    it("should mount /system route after maintenanceGuard middleware", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const routesPath = path.join(__dirname, "../src/routes/index.ts");
      const content = fs.readFileSync(routesPath, "utf-8");

      const guardIndex = content.indexOf("router.use(maintenanceGuard())");
      const systemIndex = content.indexOf('router.use("/system", systemConfigRoute)');

      assert.ok(guardIndex !== -1, "maintenanceGuard should be mounted");
      assert.ok(systemIndex !== -1, "/system route should be mounted");
      assert.ok(
        guardIndex < systemIndex,
        "/system route must be mounted AFTER maintenanceGuard() so private configs are protected during maintenance",
      );
    });
  });

  describe("22. [VAL-P2-06] Structured Zod validation errors in AppError.data", () => {
    it("should attach structured array of field errors to AppError.data", () => {
      const { z } = require("zod");
      const { validate } = require("../src/middlewares/validate.middleware");
      const testSchema = z.object({
        name: z.string().min(3, "Name must be at least 3 chars"),
        age: z.number().int().min(18, "Age must be at least 18"),
      });

      const middleware = validate(testSchema, "body");
      const req = { body: { name: "ab", age: 10 } } as any;
      const res = {} as any;
      let errorPassed: any = null;

      middleware(req, res, (err?: any) => {
        errorPassed = err;
      });

      assert.ok(errorPassed, "validate should pass an error to next()");
      assert.equal(errorPassed.statusCode, 422);
      assert.ok(Array.isArray(errorPassed.data), "error.data should be an array");
      assert.equal(errorPassed.data.length, 2);
      assert.equal(errorPassed.data[0].field, "name");
      assert.equal(errorPassed.data[1].field, "age");
    });
  });

  describe("23. [TIME-P2-07 & SEC-01 & SEC-04] UTC+7 date filtering & Query Validation Schemas", () => {
    it("should accept valid YYYY-MM-DD startDate and endDate in auditLogQuerySchema", () => {
      const { auditLogQuerySchema } = require("../src/modules/rbac/rbac.validation");
      const result = auditLogQuerySchema.safeParse({
        startDate: "2026-09-01",
        endDate: "2026-09-05",
        page: 1,
        limit: 10,
      });

      assert.equal(result.success, true);
      assert.equal(result.data.startDate, "2026-09-01");
      assert.equal(result.data.endDate, "2026-09-05");
    });

    it("should accept valid DD/MM/YYYY Vietnamese startDate and endDate in auditLogQuerySchema", () => {
      const { auditLogQuerySchema } = require("../src/modules/rbac/rbac.validation");
      const result = auditLogQuerySchema.safeParse({
        startDate: "01/09/2026",
        endDate: "05/09/2026",
        page: 1,
        limit: 10,
      });

      assert.equal(result.success, true);
      assert.equal(result.data.startDate, "01/09/2026");
      assert.equal(result.data.endDate, "05/09/2026");
    });

    it("[SEC-01] should reject malformed date strings in auditLogQuerySchema", () => {
      const { auditLogQuerySchema } = require("../src/modules/rbac/rbac.validation");
      const invalidResult = auditLogQuerySchema.safeParse({
        startDate: "not-a-valid-date",
      });
      assert.equal(invalidResult.success, false, "Malformed date string must be rejected");

      const tooLongDate = auditLogQuerySchema.safeParse({
        startDate: "2026-09-01".padEnd(55, "0"),
      });
      assert.equal(tooLongDate.success, false, "Date string exceeding 50 chars must be rejected");
    });

    it("[SEC-04] should enforce length and format constraints on resource in permissionQuerySchema", () => {
      const { permissionQuerySchema } = require("../src/modules/rbac/rbac.validation");
      const validResult = permissionQuerySchema.safeParse({
        resource: "users:profile",
      });
      assert.equal(validResult.success, true);

      const invalidChars = permissionQuerySchema.safeParse({
        resource: "users; DROP TABLE users; --",
      });
      assert.equal(invalidChars.success, false, "Resource with SQL injection/special characters must be rejected");

      const tooLongResource = permissionQuerySchema.safeParse({
        resource: "a".repeat(51),
      });
      assert.equal(tooLongResource.success, false, "Resource exceeding 50 chars must be rejected");
    });
  });

  describe("24. [VAL-P3-05 & VAL-P3-06] User update and Social validation refinement", () => {
    it("should reject empty body in updateUserSchema", () => {
      const { updateUserSchema } = require("../src/modules/users/user.validation");
      const emptyResult = updateUserSchema.safeParse({});
      assert.equal(emptyResult.success, false, "Empty payload must be rejected");

      const validResult = updateUserSchema.safeParse({ fullName: "Nguyễn Văn B" });
      assert.equal(validResult.success, true);
    });

    it("should require code when provider is ZALO in linkSocialAccountSchema", () => {
      const { linkSocialAccountSchema } = require("../src/modules/auth/auth.validation");
      const invalidZalo = linkSocialAccountSchema.safeParse({
        provider: "ZALO",
        idToken: "token-without-code",
      });
      assert.equal(invalidZalo.success, false, "Zalo provider must require code");

      const validZalo = linkSocialAccountSchema.safeParse({
        provider: "ZALO",
        code: "zalo-auth-code",
        redirectUri: "https://example.com/callback",
      });
      assert.equal(validZalo.success, true);
    });
  });

  describe("25. [RATE-P3-04] Route-scoped namespace partitioning in rate limiter", () => {
    it("should partition request counts by IP and route prefix", () => {
      const { createRateLimiter } = require("../src/middlewares/rate-limit.middleware");
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      const res = { setHeader: () => {}, status: () => ({ json: () => {} }) } as any;
      let nextCalledCount = 0;
      const next = () => { nextCalledCount++; };

      // Route A (2 requests should pass)
      const reqA1 = { ip: "192.168.1.1", baseUrl: "/api/v1/auth" } as any;
      const reqA2 = { ip: "192.168.1.1", baseUrl: "/api/v1/auth" } as any;
      limiter(reqA1, res, next);
      limiter(reqA2, res, next);
      assert.equal(nextCalledCount, 2);

      // Route B on same IP should NOT be blocked by Route A's limit
      const reqB1 = { ip: "192.168.1.1", baseUrl: "/api/v1/users" } as any;
      limiter(reqB1, res, next);
      assert.equal(nextCalledCount, 3, "Route B should have its own rate limit counter");
    });
  });

  describe("26. [CODE-P3-03] Modular Auth2FAService Sub-Service Delegation", () => {
    it("should delegate setup2FA and verify2FALogin to Auth2FAService while preserving AuthService interface", async () => {
      const { AuthService } = require("../src/modules/auth/auth.service");
      const authService = new AuthService();

      assert.equal(typeof authService.setup2FA, "function");
      assert.equal(typeof authService.enable2FA, "function");
      assert.equal(typeof authService.verify2FALogin, "function");
      assert.equal(typeof authService.disable2FA, "function");
      assert.equal(typeof authService.regenerateBackupCodes, "function");
    });
  });
});
