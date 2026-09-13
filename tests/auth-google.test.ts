import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthRepository } from "../src/modules/auth/auth.repository";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { ROLES } from "../src/common/constants/role.constant";
import { AUDIT_ACTION } from "../src/common/constants/audit-log.constant";
import { AUTH_PROVIDER } from "../src/common/constants/auth.constant";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { AppError } from "../src/common/errors/app-error";
import { jwtConfig } from "../src/config/jwt.config";
import { envConfig } from "../src/config/env.config";
import {
  verifyGoogleIdToken,
  exchangeGoogleCode,
  generateGoogleAuthUrl,
} from "../src/common/helpers/google-auth.helper";
import {
  googleLoginSchema,
  googleAuthUrlQuerySchema,
  linkSocialAccountSchema,
  unlinkSocialAccountParamSchema,
} from "../src/modules/auth/auth.validation";
import { swaggerSpec } from "../src/config/swagger.config";

describe("Google OAuth2 Login & Account Linking Test Suite", () => {
  let authService: AuthService;
  let mockRepository: Partial<AuthRepository>;
  let auditLogs: Array<any> = [];
  let savedRefreshTokens: Array<any> = [];
  let socialLinks: Array<{
    userId: string;
    provider: string;
    providerUserId: string;
  }> = [];
  let createdSocialUsers: Array<any> = [];
  let activatedUsers: Array<string> = [];

  const originalFetch = globalThis.fetch;
  const roleId = "a0000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    auditLogs = [];
    savedRefreshTokens = [];
    socialLinks = [];
    createdSocialUsers = [];
    activatedUsers = [];
    permissionCacheService.clear();

    (permissionCacheService as any).cache.set(roleId, {
      permissions: new Set(["USER_READ", "USER_UPDATE"]),
      expiresAt: Date.now() + 600000,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── 1. Google Auth Helper Unit Tests ─────────────────────────────────────────

  describe("google-auth.helper", () => {
    it("should verify valid Google ID Token successfully", async () => {
      const mockPayload = {
        iss: "https://accounts.google.com",
        sub: "google-sub-123456",
        aud: "test-google-client-id.apps.googleusercontent.com",
        email: "test.user@gmail.com",
        email_verified: "true",
        name: "Test Google User",
        picture: "https://lh3.googleusercontent.com/avatar.jpg",
        exp: String(Math.floor(Date.now() / 1000) + 3600),
      };

      globalThis.fetch = async (url: any) => {
        if (String(url).includes("oauth2.googleapis.com/tokeninfo")) {
          return new Response(JSON.stringify(mockPayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not found", { status: 404 });
      };

      const profile = await verifyGoogleIdToken(
        "valid-id-token",
        "test-google-client-id.apps.googleusercontent.com",
      );

      assert.equal(profile.providerUserId, "google-sub-123456");
      assert.equal(profile.email, "test.user@gmail.com");
      assert.equal(profile.emailVerified, true);
      assert.equal(profile.fullName, "Test Google User");
      assert.equal(
        profile.avatarUrl,
        "https://lh3.googleusercontent.com/avatar.jpg",
      );
    });

    it("should reject empty or whitespace ID Token", async () => {
      await assert.rejects(
        async () => verifyGoogleIdToken("   "),
        (err: AppError) =>
          err.statusCode === 400 && err.code === ERROR_CODE.VALIDATION_ERROR,
      );
    });

    it("should reject token when Google returns 400 (invalid token)", async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error_description: "Invalid Value" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });

      await assert.rejects(
        async () => verifyGoogleIdToken("invalid-token"),
        (err: AppError) =>
          err.statusCode === 401 && err.code === ERROR_CODE.GOOGLE_AUTH_FAILED,
      );
    });

    it("should reject token with invalid issuer", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://evil-issuer.com",
            sub: "123",
            email: "user@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      await assert.rejects(
        async () => verifyGoogleIdToken("bad-iss-token"),
        (err: AppError) =>
          err.statusCode === 401 && err.code === ERROR_CODE.GOOGLE_AUTH_FAILED,
      );
    });

    it("should reject token when Client ID (aud) does not match expectedClientId", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "123",
            aud: "other-app-client-id.apps.googleusercontent.com",
            email: "user@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      await assert.rejects(
        async () =>
          verifyGoogleIdToken("mismatched-aud-token", "my-expected-client-id"),
        (err: AppError) =>
          err.statusCode === 401 && err.code === ERROR_CODE.GOOGLE_AUTH_FAILED,
      );
    });

    it("should reject expired Google ID Token", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "123",
            email: "user@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) - 3600), // Expired 1 hour ago
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      await assert.rejects(
        async () => verifyGoogleIdToken("expired-token"),
        (err: AppError) =>
          err.statusCode === 401 && err.code === ERROR_CODE.GOOGLE_AUTH_FAILED,
      );
    });

    it("should reject token when Google email is not verified", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "123",
            email: "unverified@gmail.com",
            email_verified: false,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      await assert.rejects(
        async () => verifyGoogleIdToken("unverified-email-token"),
        (err: AppError) =>
          err.statusCode === 400 && err.code === ERROR_CODE.VALIDATION_ERROR,
      );
    });

    it("should exchange authorization code for tokens successfully", async () => {
      globalThis.fetch = async (url: any, opts: any) => {
        if (String(url).includes("oauth2.googleapis.com/token")) {
          assert.equal(opts.method, "POST");
          return new Response(
            JSON.stringify({
              id_token: "returned-id-token",
              access_token: "returned-access-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      };

      const tokens = await exchangeGoogleCode(
        "sample-auth-code",
        "http://localhost:3000/callback",
        "client-id-123",
        "client-secret-xyz",
      );

      assert.equal(tokens.idToken, "returned-id-token");
      assert.equal(tokens.accessToken, "returned-access-token");
    });

    it("should generate Google OAuth2 authorization URL with correct parameters", () => {
      const url = generateGoogleAuthUrl(
        "client-id-xyz",
        "http://localhost:7777/api/v1/auth/google/callback",
        "random-state-123",
      );

      const parsedUrl = new URL(url);
      assert.equal(parsedUrl.origin, "https://accounts.google.com");
      assert.equal(parsedUrl.pathname, "/o/oauth2/v2/auth");
      assert.equal(parsedUrl.searchParams.get("client_id"), "client-id-xyz");
      assert.equal(
        parsedUrl.searchParams.get("redirect_uri"),
        "http://localhost:7777/api/v1/auth/google/callback",
      );
      assert.equal(parsedUrl.searchParams.get("state"), "random-state-123");
      assert.equal(parsedUrl.searchParams.get("response_type"), "code");
      assert.equal(parsedUrl.searchParams.get("scope"), "openid email profile");
    });
  });

  // ── 2. AuthService Integration Flow Tests ────────────────────────────────────

  describe("AuthService.googleLogin", () => {
    it("should register and log in new user via Google when not existing in DB", async () => {
      // Mock Google fetch
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-new-user",
            aud: envConfig.google.clientId || "test-client-id",
            email: "newuser@gmail.com",
            email_verified: true,
            name: "New Google User",
            picture: "https://avatar.google.com/new.png",
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      mockRepository = {
        findBySocial: async () => null,
        findByEmail: async () => null,
        findRoleByName: async () => ({
          id: roleId,
          name: ROLES.USER,
          description: null,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        createSocialUser: async (data: any) => {
          const newUser = {
            id: "b1111111-0000-0000-0000-000000000001",
            email: data.email,
            fullName: data.fullName,
            avatarUrl: data.avatarUrl,
            phoneNumber: null,
            isActive: true,
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorBackupCodes: null,
            deletedAt: null,
            deletedBy: null,
            roleId: data.roleId,
            role: { id: data.roleId, name: ROLES.USER },
          };
          createdSocialUsers.push({ ...data, user: newUser });
          return newUser as any;
        },
        saveRefreshToken: async (
          userId: string,
          token: string,
          expiresAt: Date,
        ) => {
          savedRefreshTokens.push({ userId, token, expiresAt });
          return {} as any;
        },
        findUserDevice: async () => ({ id: "mock-device-1" }) as any,
        upsertUserDevice: async () => ({}) as any,
        updateUserDeviceLastLogin: async () => ({}) as any,
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.googleLogin(
        { idToken: "valid-google-id-token" },
        { userAgent: "Mozilla/5.0 Test Chrome", ipAddress: "127.0.0.1" },
      );

      assert.equal(result.requires2FA, undefined);
      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
      assert.equal(result.user?.email, "newuser@gmail.com");
      assert.equal(result.user?.fullName, "New Google User");
      assert.equal(result.user?.role, ROLES.USER);

      // Verify DB creation
      assert.equal(createdSocialUsers.length, 1);
      assert.equal(createdSocialUsers[0].provider, AUTH_PROVIDER.GOOGLE);
      assert.equal(createdSocialUsers[0].providerUserId, "google-sub-new-user");

      // Verify Audit Log
      const loginAudit = auditLogs.find(
        (l) => l.action === AUDIT_ACTION.LOGIN_GOOGLE,
      );
      assert.ok(loginAudit);
      assert.equal(loginAudit.targetId, "b1111111-0000-0000-0000-000000000001");
    });

    it("should log in existing user linked via UserSocial", async () => {
      const existingUser = {
        id: "existing-linked-user",
        email: "linked@gmail.com",
        fullName: "Linked User",
        phoneNumber: null,
        avatarUrl: null,
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        deletedAt: null,
        deletedBy: null,
        roleId,
        role: { id: roleId, name: ROLES.USER },
      };

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-existing",
            aud: envConfig.google.clientId || "test-client-id",
            email: "linked@gmail.com",
            email_verified: true,
            name: "Linked User",
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      mockRepository = {
        findBySocial: async (provider: string, providerUserId: string) => {
          if (
            provider === AUTH_PROVIDER.GOOGLE &&
            providerUserId === "google-sub-existing"
          ) {
            return existingUser as any;
          }
          return null;
        },
        saveRefreshToken: async (
          userId: string,
          token: string,
          expiresAt: Date,
        ) => {
          savedRefreshTokens.push({ userId, token, expiresAt });
          return {} as any;
        },
        findUserDevice: async () => ({ id: "mock-device-1" }) as any,
        upsertUserDevice: async () => ({}) as any,
        updateUserDeviceLastLogin: async () => ({}) as any,
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.googleLogin({ idToken: "valid-token" });

      assert.ok(result.accessToken);
      assert.equal(result.user?.id, "existing-linked-user");
      assert.equal(result.user?.email, "linked@gmail.com");
      assert.equal(
        auditLogs.some((l) => l.action === AUDIT_ACTION.LOGIN_GOOGLE),
        true,
      );
    });

    it("should link Google account to existing local user with matching email and activate if inactive", async () => {
      const existingLocalUser = {
        id: "local-user-id-123",
        email: "localuser@gmail.com",
        fullName: "Local User",
        phoneNumber: null,
        avatarUrl: null,
        isActive: false, // Registered locally, not yet activated
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        deletedAt: null,
        deletedBy: null,
        roleId,
        role: { id: roleId, name: ROLES.USER },
      };

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-local-link",
            aud: envConfig.google.clientId || "test-client-id",
            email: "localuser@gmail.com",
            email_verified: true,
            name: "Local User Updated",
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      mockRepository = {
        findBySocial: async () => null, // Not yet linked
        findByEmail: async (email: string) => {
          if (email === "localuser@gmail.com") return existingLocalUser as any;
          return null;
        },
        linkSocialAccount: async (
          userId: string,
          provider: string,
          providerUserId: string,
        ) => {
          socialLinks.push({ userId, provider, providerUserId });
          return {} as any;
        },
        activateUser: async (userId: string) => {
          activatedUsers.push(userId);
          existingLocalUser.isActive = true;
          return existingLocalUser as any;
        },
        activateUserAndClearPassword: async (userId: string) => {
          activatedUsers.push(userId);
          existingLocalUser.isActive = true;
          existingLocalUser.password = null;
          return existingLocalUser as any;
        },
        saveRefreshToken: async (
          userId: string,
          token: string,
          expiresAt: Date,
        ) => {
          savedRefreshTokens.push({ userId, token, expiresAt });
          return {} as any;
        },
        findUserDevice: async () => ({ id: "mock-device-1" }) as any,
        upsertUserDevice: async () => ({}) as any,
        updateUserDeviceLastLogin: async () => ({}) as any,
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.googleLogin({ idToken: "valid-token" });

      // Check account was linked
      assert.equal(socialLinks.length, 1);
      assert.equal(socialLinks[0].userId, "local-user-id-123");
      assert.equal(socialLinks[0].provider, AUTH_PROVIDER.GOOGLE);
      assert.equal(socialLinks[0].providerUserId, "google-sub-local-link");

      // Check user was activated and password was cleared to prevent pre-account hijacking (SEC-03)
      assert.equal(activatedUsers.includes("local-user-id-123"), true);
      assert.equal(existingLocalUser.password, null);

      // Check Audit logs for both LINK_SOCIAL_ACCOUNT and LOGIN_GOOGLE
      assert.equal(
        auditLogs.some((l) => l.action === AUDIT_ACTION.LINK_SOCIAL_ACCOUNT),
        true,
      );
      assert.equal(
        auditLogs.some((l) => l.action === AUDIT_ACTION.LOGIN_GOOGLE),
        true,
      );

      assert.ok(result.accessToken);
      assert.equal(result.user?.id, "local-user-id-123");
    });

    it("should enforce 2FA challenge when user has 2FA enabled (Zero Bypass)", async () => {
      const userWith2FA = {
        id: "user-with-2fa-id",
        email: "user2fa@gmail.com",
        fullName: "User TwoFactor",
        phoneNumber: null,
        avatarUrl: null,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: "encrypted-secret",
        twoFactorBackupCodes: [],
        deletedAt: null,
        deletedBy: null,
        roleId,
        role: { id: roleId, name: ROLES.USER },
      };

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-2fa",
            aud: envConfig.google.clientId || "test-client-id",
            email: "user2fa@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      mockRepository = {
        findBySocial: async () => userWith2FA as any,
        saveRefreshToken: async () => {
          assert.fail("Should NOT save refresh token when 2FA is required");
        },
        createAuditLog: async () => ({}) as any,
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.googleLogin({ idToken: "valid-token" });

      // Must return 2FA challenge and NO auth tokens
      assert.equal(result.requires2FA, true);
      assert.ok(result.tempToken);
      assert.equal(result.accessToken, undefined);
      assert.equal(result.refreshToken, undefined);

      // Verify tempToken structure
      const decoded: any = jwt.verify(result.tempToken, jwtConfig.accessSecret);
      assert.equal(decoded.id, "user-with-2fa-id");
      assert.equal(decoded.purpose, "2FA_VERIFICATION");
    });

    it("should reject login if user account has been soft-deleted", async () => {
      const deletedUser = {
        id: "deleted-user-id",
        email: "deleted@gmail.com",
        fullName: "Deleted User",
        isActive: false,
        deletedAt: new Date(),
        roleId,
        role: { id: roleId, name: ROLES.USER },
      };

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-deleted",
            aud: envConfig.google.clientId || "test-client-id",
            email: "deleted@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      mockRepository = {
        findBySocial: async () => deletedUser as any,
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await assert.rejects(
        async () => authService.googleLogin({ idToken: "valid-token" }),
        (err: AppError) =>
          err.statusCode === 403 && err.code === ERROR_CODE.USER_INACTIVE,
      );
    });
  });

  // ── 3. Validation Schema Tests ───────────────────────────────────────────────

  describe("Google Validation Schemas", () => {
    it("should accept valid googleLoginSchema with idToken", () => {
      const parsed = googleLoginSchema.safeParse({
        idToken: "sample-google-id-token-abc",
      });
      assert.equal(parsed.success, true);
    });

    it("should accept valid googleLoginSchema with code and redirectUri", () => {
      const parsed = googleLoginSchema.safeParse({
        code: "sample-authorization-code-123",
        redirectUri: "http://localhost:3000/auth/google/callback",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject googleLoginSchema when neither idToken nor code is provided", () => {
      const parsed = googleLoginSchema.safeParse({});
      assert.equal(parsed.success, false);
    });

    it("should reject googleLoginSchema when code is provided without redirectUri", () => {
      const parsed = googleLoginSchema.safeParse({
        code: "auth-code-only",
      });
      assert.equal(parsed.success, false);
    });

    it("should validate googleAuthUrlQuerySchema correctly", () => {
      const valid = googleAuthUrlQuerySchema.safeParse({
        redirectUri: "https://myapp.com/callback",
        state: "csrf-protection-token-xyz",
      });
      assert.equal(valid.success, true);

      const invalid = googleAuthUrlQuerySchema.safeParse({
        redirectUri: "not-a-valid-url",
      });
      assert.equal(invalid.success, false);
    });

    it("should validate linkSocialAccountSchema correctly", () => {
      const validIdToken = linkSocialAccountSchema.safeParse({
        provider: "GOOGLE",
        idToken: "test-token-123",
      });
      assert.equal(validIdToken.success, true);

      const validCode = linkSocialAccountSchema.safeParse({
        provider: "GOOGLE",
        code: "test-code-123",
        redirectUri: "https://example.com/callback",
      });
      assert.equal(validCode.success, true);

      const invalidEmpty = linkSocialAccountSchema.safeParse({
        provider: "GOOGLE",
      });
      assert.equal(invalidEmpty.success, false);
    });

    it("should validate unlinkSocialAccountParamSchema correctly", () => {
      assert.equal(
        unlinkSocialAccountParamSchema.safeParse({ provider: "GOOGLE" })
          .success,
        true,
      );
      assert.equal(
        unlinkSocialAccountParamSchema.safeParse({ provider: "ZALO" }).success,
        true,
      );
      assert.equal(
        unlinkSocialAccountParamSchema.safeParse({ provider: "GITHUB" })
          .success,
        false,
      );
    });
  });

  // ── 4. Profile Social Accounts Management ─────────────────────────────────────

  describe("Profile Social Accounts Management (get, link, unlink)", () => {
    const currentUserId = "b1111111-0000-0000-0000-000000000001";
    let currentUser: any;

    beforeEach(() => {
      currentUser = {
        id: currentUserId,
        email: "current@example.com",
        password: "hashed-password-123",
        fullName: "Current User",
        isActive: true,
        twoFactorEnabled: false,
        deletedAt: null,
        roleId,
        role: { id: roleId, name: ROLES.USER },
      };
    });

    it("should get linked social accounts for current user", async () => {
      const mockAccounts = [
        {
          id: "social-uuid-1",
          provider: "GOOGLE",
          providerUserId: "google-sub-current",
          createdAt: new Date(),
        },
      ];

      mockRepository = {
        findById: async (id: string) =>
          id === currentUserId ? (currentUser as any) : null,
        getUserSocialAccounts: async (userId: string) =>
          userId === currentUserId ? (mockAccounts as any) : [],
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.getSocialAccounts(currentUserId);
      assert.equal(result.length, 1);
      assert.equal(result[0].provider, "GOOGLE");
      assert.equal(result[0].providerUserId, "google-sub-current");
    });

    it("should link Google account successfully in profile", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-profile-link",
            aud: envConfig.google.clientId || "test-client-id",
            email: "google.linked@gmail.com",
            email_verified: true,
            name: "Linked Google Account",
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      let createdLink: any = null;

      mockRepository = {
        findById: async (id: string) =>
          id === currentUserId ? (currentUser as any) : null,
        findUserSocialByProvider: async () => null, // Not yet linked to Google
        findBySocial: async () => null, // Not linked to anyone else
        linkSocialAccount: async (
          userId: string,
          provider: string,
          providerUserId: string,
        ) => {
          createdLink = { userId, provider, providerUserId };
          return {} as any;
        },
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      const result = await authService.linkSocialAccount(currentUserId, {
        provider: "GOOGLE",
        idToken: "valid-profile-id-token",
      });

      assert.equal(result.provider, "GOOGLE");
      assert.equal(result.email, "google.linked@gmail.com");
      assert.ok(createdLink);
      assert.equal(createdLink.userId, currentUserId);
      assert.equal(createdLink.providerUserId, "google-sub-profile-link");

      const linkAudit = auditLogs.find(
        (l) => l.action === AUDIT_ACTION.LINK_SOCIAL_ACCOUNT,
      );
      assert.ok(linkAudit);
      assert.equal(linkAudit.details?.source, "PROFILE_MANUAL_LINK");
    });

    it("should reject link if current user already linked with Google", async () => {
      mockRepository = {
        findById: async () => currentUser as any,
        findUserSocialByProvider: async () =>
          ({ id: "existing-google-link" }) as any,
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await assert.rejects(
        async () =>
          authService.linkSocialAccount(currentUserId, {
            provider: "GOOGLE",
            idToken: "token-123",
          }),
        (err: AppError) =>
          err.statusCode === 400 && err.code === ERROR_CODE.VALIDATION_ERROR,
      );
    });

    it("should reject link with 409 if Google account is already linked to another user (Collision Guard)", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-sub-taken",
            aud: envConfig.google.clientId || "test-client-id",
            email: "taken@gmail.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      const otherUser = {
        id: "other-user-uuid-999",
        email: "other@example.com",
      };

      mockRepository = {
        findById: async () => currentUser as any,
        findUserSocialByProvider: async () => null,
        findBySocial: async () => otherUser as any, // Belonging to another user!
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await assert.rejects(
        async () =>
          authService.linkSocialAccount(currentUserId, {
            provider: "GOOGLE",
            idToken: "token-123",
          }),
        (err: AppError) =>
          err.statusCode === 409 && err.code === ERROR_CODE.DUPLICATE_ENTRY,
      );
    });

    it("should unlink Google account successfully when user has a password", async () => {
      let unlinkedProvider = "";

      mockRepository = {
        findById: async () => currentUser as any, // has password
        findUserSocialByProvider: async () => ({ id: "social-link-1" }) as any,
        unlinkSocialAccount: async (_userId: string, provider: string) => {
          unlinkedProvider = provider;
          return { count: 1 } as any;
        },
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await authService.unlinkSocialAccount(currentUserId, "GOOGLE");
      assert.equal(unlinkedProvider, "GOOGLE");
      assert.equal(
        auditLogs.some((l) => l.action === AUDIT_ACTION.UNLINK_SOCIAL_ACCOUNT),
        true,
      );
    });

    it("should prevent unlinking with 400 when user has NO password and only 1 social account (Anti-Lockout)", async () => {
      currentUser.password = null; // Registered via Google only, no password set

      mockRepository = {
        findById: async () => currentUser as any,
        findUserSocialByProvider: async () => ({ id: "social-link-1" }) as any,
        countUserSocialAccounts: async () => 1, // Only 1 social account!
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await assert.rejects(
        async () => authService.unlinkSocialAccount(currentUserId, "GOOGLE"),
        (err: AppError) =>
          err.statusCode === 400 &&
          err.code === ERROR_CODE.VALIDATION_ERROR &&
          err.message.includes("Không thể hủy phương thức đăng nhập duy nhất"),
      );
    });

    it("should allow unlinking when user has NO password BUT has more than 1 social account", async () => {
      currentUser.password = null;
      let unlinkedProvider = "";

      mockRepository = {
        findById: async () => currentUser as any,
        findUserSocialByProvider: async () => ({ id: "social-link-1" }) as any,
        countUserSocialAccounts: async () => 2, // Has Google and Zalo
        unlinkSocialAccount: async (_userId: string, provider: string) => {
          unlinkedProvider = provider;
          return { count: 1 } as any;
        },
        createAuditLog: async (log: any) => {
          auditLogs.push(log);
          return {} as any;
        },
      };

      authService = new AuthService();
      (authService as any).repository = mockRepository;

      await authService.unlinkSocialAccount(currentUserId, "GOOGLE");
      assert.equal(unlinkedProvider, "GOOGLE");
    });
  });

  // ── 5. OpenAPI Specification Integration ─────────────────────────────────────

  describe("OpenAPI Swagger Documentation", () => {
    it("should register /api/v1/auth/google in Swagger specification", () => {
      const paths = swaggerSpec.paths;
      assert.ok(paths["/api/v1/auth/google"] || paths["/auth/google"]);
      const googlePost = (paths["/api/v1/auth/google"] || paths["/auth/google"])
        .post;
      assert.ok(googlePost);
      assert.equal(googlePost.tags.includes("Auth - Social"), true);
    });

    it("should register /api/v1/auth/google/url in Swagger specification", () => {
      const paths = swaggerSpec.paths;
      assert.ok(paths["/api/v1/auth/google/url"] || paths["/auth/google/url"]);
      const googleGet = (
        paths["/api/v1/auth/google/url"] || paths["/auth/google/url"]
      ).get;
      assert.ok(googleGet);
      assert.equal(googleGet.tags.includes("Auth - Social"), true);
    });

    it("should register /api/v1/auth/social (GET), /social/link (POST), /social/{provider} (DELETE) in Swagger", () => {
      const paths = swaggerSpec.paths;
      assert.ok(paths["/api/v1/auth/social"] || paths["/auth/social"]);
      assert.ok(
        paths["/api/v1/auth/social/link"] || paths["/auth/social/link"],
      );
      assert.ok(
        paths["/api/v1/auth/social/{provider}"] ||
          paths["/auth/social/{provider}"],
      );

      const socialGet = (paths["/api/v1/auth/social"] || paths["/auth/social"])
        .get;
      assert.ok(socialGet);

      const linkPost = (
        paths["/api/v1/auth/social/link"] || paths["/auth/social/link"]
      ).post;
      assert.ok(linkPost);

      const unlinkDelete = (
        paths["/api/v1/auth/social/{provider}"] ||
        paths["/auth/social/{provider}"]
      ).delete;
      assert.ok(unlinkDelete);
    });
  });
});
