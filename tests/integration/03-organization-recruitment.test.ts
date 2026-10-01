import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";
import { prisma } from "../../src/database/prisma.client";

describe("INTEGRATION: Organization & Recruitment Modules", () => {
  const testTag = `integ_org_${Date.now()}`;
  let createdDepartmentId = "";
  let adminToken = "";
  let leaderToken = "";
  let internToken = "";

  before(async () => {
    await harness.start();
    adminToken = await harness.getAdminToken();
    leaderToken = await harness.getLeaderToken();
    internToken = await harness.getInternToken();
    await harness.cleanupFixturesByTag(testTag);
  });

  after(async () => {
    if (createdDepartmentId) {
      await prisma.department.deleteMany({
        where: { id: createdDepartmentId },
      });
    }
    await harness.cleanupFixturesByTag(testTag);
    await harness.stop();
  });

  describe("Departments Management (/departments)", () => {
    it("GET /departments - should return list of departments with HTTP 200", async () => {
      const res = await harness.get("/departments");
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("POST /departments - should create a new department with HTTP 201 for Admin", async () => {
      const res = await harness.post(
        "/departments",
        {
          name: `Department ${testTag}`,
          description: `Integration test department ${testTag}`,
        },
        { token: adminToken },
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      createdDepartmentId = res.body.data.id;

      // Assert DB state via Prisma
      const dbDept = await prisma.department.findUnique({
        where: { id: createdDepartmentId },
      });
      assert.ok(dbDept);
      assert.equal(dbDept.name, `Department ${testTag}`);
    });

    it("GET /departments/:id - should retrieve department details with HTTP 200", async () => {
      const res = await harness.get(`/departments/${createdDepartmentId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdDepartmentId);
    });

    it("PUT /departments/:id - should update department details with HTTP 200", async () => {
      const res = await harness.put(
        `/departments/${createdDepartmentId}`,
        {
          name: `Department ${testTag} Updated`,
        },
        { token: adminToken },
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, `Department ${testTag} Updated`);
    });

    it("DELETE /departments/:id - should remove department with HTTP 200", async () => {
      const res = await harness.delete(`/departments/${createdDepartmentId}`, {
        token: adminToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify soft deletion in database
      const dbDept = await prisma.department.findUnique({
        where: { id: createdDepartmentId },
      });
      assert.ok(dbDept?.deletedAt !== null);
      createdDepartmentId = "";
    });
  });

  describe("Leaders & Interns Directory (/leaders, /interns)", () => {
    it("GET /leaders - should allow Admin/Leader to list leaders with HTTP 200", async () => {
      const res = await harness.get("/leaders", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /leaders/me - should return self leader profile with HTTP 200", async () => {
      const res = await harness.get("/leaders/me", { token: leaderToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });

    it("GET /interns - should allow Admin to list interns with HTTP 200", async () => {
      const res = await harness.get("/interns", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /interns/me - should return self intern profile with HTTP 200", async () => {
      const res = await harness.get("/interns/me", { token: internToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
    });
  });

  describe("Recruitment & Regulations (/applications, /regulations)", () => {
    it("GET /applications - should return applications list with HTTP 200", async () => {
      const res = await harness.get("/applications", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /applications/invites - should return application invites with HTTP 200", async () => {
      const res = await harness.get("/applications/invites", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /regulations - should return list of company regulations with HTTP 200", async () => {
      const res = await harness.get("/regulations", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = res.body.items || (Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items));
      assert.ok(Array.isArray(items));
    });
  });
});
