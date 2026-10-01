import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";
import { prisma } from "../../src/database/prisma.client";

describe("INTEGRATION: Auth, Users & RBAC Architecture", () => {
  const testTag = `integ_usr_${Date.now()}`;
  const testEmail = `${testTag}@nexcampus.test`;
  const testPassword = "Password@123Xyz";
  let registeredUserId = "";
  let userAccessToken = "";
  let userRefreshToken = "";

  before(async () => {
    await harness.start();
    await harness.cleanupFixturesByTag(testTag);
  });

  after(async () => {
    await harness.cleanupFixturesByTag(testTag);
    await harness.stop();
  });

  describe("Authentication Lifecycle (/auth)", () => {
    it("POST /auth/register - should create a new user account with HTTP 201", async () => {
      const res = await harness.post("/auth/register", {
        email: testEmail,
        password: testPassword,
        fullName: "Integration Test User",
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);

      // Verify side-effect directly in database via Prisma
      const dbUser = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      assert.ok(dbUser);
      assert.equal(dbUser.email, testEmail);
      registeredUserId = dbUser.id;

      // Activate user so login test can authenticate
      await prisma.user.update({
        where: { id: registeredUserId },
        data: { isActive: true },
      });
    });

    it("POST /auth/register - should reject duplicate email registration with HTTP 400", async () => {
      const res = await harness.post("/auth/register", {
        email: testEmail,
        password: testPassword,
        fullName: "Duplicate User",
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it("POST /auth/login - should reject invalid credentials with HTTP 401", async () => {
      const res = await harness.post("/auth/login", {
        email: testEmail,
        password: "WrongPassword!999",
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it("POST /auth/login - should authenticate valid user and issue tokens with HTTP 200", async () => {
      const res = await harness.post("/auth/login", {
        email: testEmail,
        password: testPassword,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.accessToken);
      assert.ok(res.body.data.refreshToken);

      userAccessToken = res.body.data.accessToken;
      userRefreshToken = res.body.data.refreshToken;

      // Verify session created in DB
      const session = await prisma.refreshToken.findFirst({
        where: { userId: registeredUserId },
      });
      assert.ok(session);
    });

    it("GET /auth/me - should return authenticated user profile with HTTP 200", async () => {
      const res = await harness.get("/auth/me", { token: userAccessToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.email, testEmail);
    });

    it("GET /auth/me - should reject request without token with HTTP 401", async () => {
      const res = await harness.get("/auth/me");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it("GET /auth/sessions - should list active sessions with HTTP 200", async () => {
      const res = await harness.get("/auth/sessions", { token: userAccessToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it("POST /auth/refresh - should refresh access token with HTTP 200", async () => {
      const res = await harness.post("/auth/refresh", {
        refreshToken: userRefreshToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.accessToken);
      userAccessToken = res.body.data.accessToken;
    });
  });

  describe("Users & Authorization Guard (/users)", () => {
    it("GET /users - should allow Admin access to list all users with HTTP 200", async () => {
      const adminToken = await harness.getAdminToken();
      const res = await harness.get("/users", {
        token: adminToken,
        query: { page: 1, limit: 10 },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.meta);
    });

    it("GET /users - should block regular user with HTTP 403 Forbidden", async () => {
      const res = await harness.get("/users", { token: userAccessToken });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it("GET /users/:id - should allow Admin to retrieve user detail with HTTP 200", async () => {
      const adminToken = await harness.getAdminToken();
      const res = await harness.get(`/users/${registeredUserId}`, { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, registeredUserId);
      assert.equal(res.body.data.email, testEmail);
    });
  });

  describe("RBAC System Management (/rbac)", () => {
    it("GET /rbac/roles - should return system roles with HTTP 200 for Admin", async () => {
      const adminToken = await harness.getAdminToken();
      const res = await harness.get("/rbac/roles", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      const roleNames = res.body.data.map((r: any) => r.name);
      assert.ok(roleNames.includes("ADMIN"));
      assert.ok(roleNames.includes("LEADER"));
      assert.ok(roleNames.includes("INTERN"));
    });

    it("GET /rbac/permissions - should return all system permissions with HTTP 200", async () => {
      const adminToken = await harness.getAdminToken();
      const res = await harness.get("/rbac/permissions", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 10);
    });

    it("GET /rbac/audit-logs - should return audit logs with HTTP 200", async () => {
      const adminToken = await harness.getAdminToken();
      const res = await harness.get("/rbac/audit-logs", {
        token: adminToken,
        query: { page: 1, limit: 10 },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });
});
