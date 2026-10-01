import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";

describe("INTEGRATION: Notifications, Logs, System Settings, Stats & Integrations", () => {
  let adminToken = "";

  before(async () => {
    await harness.start();
    adminToken = await harness.getAdminToken();
  });

  after(async () => {
    await harness.stop();
  });

  describe("Notifications & Settings (/notifications)", () => {
    it("GET /notifications - should list user notifications with HTTP 200", async () => {
      const res = await harness.get("/notifications", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("GET /notifications/unread-count - should return unread notification count with HTTP 200", async () => {
      const res = await harness.get("/notifications/unread-count", {
        token: adminToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(typeof (res.body.count ?? res.body.data?.unreadCount ?? res.body.data?.count), "number");
    });

    it("GET /notifications/settings - should retrieve user notification preferences with HTTP 200", async () => {
      const res = await harness.get("/notifications/settings", {
        token: adminToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });
  });

  describe("Activity & Audit Logs (/activity-logs)", () => {
    it("GET /activity-logs - should list system activity audit logs with HTTP 200 for Admin", async () => {
      const res = await harness.get("/activity-logs", {
        token: adminToken,
        query: { page: 1, limit: 10 },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.items || res.body.data?.items || res.body.data));
    });
  });

  describe("System Configuration & Settings (/system, /system-settings)", () => {
    it("GET /system/public - should return public configuration flags without auth with HTTP 200", async () => {
      const res = await harness.get("/system/public");
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });

    it("GET /system/configs - should return full configuration list for Admin with HTTP 200", async () => {
      const res = await harness.get("/system/configs", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("GET /system-settings - should return operational settings with HTTP 200", async () => {
      const res = await harness.get("/system-settings", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });
  });

  describe("Statistics & Dashboard Analytics (/stats)", () => {
    it("GET /stats - should return Admin statistics with HTTP 200", async () => {
      const res = await harness.get("/stats", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });

    it("GET /stats/admin - should return dedicated Admin dashboard metrics with HTTP 200", async () => {
      const res = await harness.get("/stats/admin", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });
  });

  describe("Integrations, API Keys & Scheduled Jobs (/integration, /cron)", () => {
    it("GET /integration/api-keys - should list integration API keys with HTTP 200", async () => {
      const res = await harness.get("/integration/api-keys", {
        token: adminToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("GET /cron/jobs - should return registered background cron jobs with HTTP 200", async () => {
      const res = await harness.get("/cron/jobs", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });
  });
});
