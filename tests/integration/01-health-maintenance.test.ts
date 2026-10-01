import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";

describe("INTEGRATION: Health & Maintenance Endpoints", () => {
  before(async () => {
    await harness.start();
  });

  after(async () => {
    await harness.stop();
  });

  describe("GET /health, /health/liveness, /health/readiness", () => {
    it("should return HTTP 200 and healthy status from /health", async () => {
      const res = await harness.get("/health");
      assert.equal(res.status, 200);
      assert.ok(res.body);
      assert.equal(res.body.status, "ok");
      assert.ok(res.body.timestamp);
    });

    it("should return HTTP 200 from /health/liveness", async () => {
      const res = await harness.get("/health/liveness");
      assert.equal(res.status, 200);
      assert.ok(res.body);
      assert.equal(res.body.status, "ok");
    });

    it("should return HTTP 200 and check services from /health/readiness", async () => {
      const res = await harness.get("/health/readiness");
      assert.equal(res.status, 200);
      assert.ok(res.body);
      assert.equal(res.body.status, "healthy");
      assert.equal(res.body.checks?.database?.status, "healthy");
    });
  });

  describe("GET /maintenance public endpoints & config security", () => {
    it("should return HTTP 200 with public maintenance status", async () => {
      const res = await harness.get("/maintenance/public");
      assert.equal(res.status, 200);
      assert.ok(res.body);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
      assert.equal(typeof res.body.data.enabled, "boolean");
    });

    it("should reject unauthenticated request to /maintenance/status with HTTP 401", async () => {
      const res = await harness.get("/maintenance/status");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it("should reject unauthenticated request to /maintenance/config with HTTP 401", async () => {
      const res = await harness.get("/maintenance/config");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it("should allow admin access to /maintenance/config and /maintenance/status with HTTP 200", async () => {
      const adminToken = await harness.getAdminToken();
      const resStatus = await harness.get("/maintenance/status", { token: adminToken });
      assert.equal(resStatus.status, 200);
      assert.equal(resStatus.body.success, true);

      const resConfig = await harness.get("/maintenance/config", { token: adminToken });
      assert.equal(resConfig.status, 200);
      assert.ok(resConfig.body);
      assert.equal(resConfig.body.success, true);
      assert.equal(typeof resConfig.body.data.enabled, "boolean");
    });
  });
});
