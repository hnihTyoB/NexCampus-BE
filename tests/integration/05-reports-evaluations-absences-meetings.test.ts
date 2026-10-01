import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";
import { prisma } from "../../src/database/prisma.client";

describe("INTEGRATION: Reports, Evaluations, Absences & Meetings Modules", () => {
  const testTag = `integ_abs_${Date.now()}`;
  let adminToken = "";
  let internToken = "";
  let createdAbsenceId = "";

  before(async () => {
    await harness.start();
    adminToken = await harness.getAdminToken();
    internToken = await harness.getInternToken();
    await prisma.absence.deleteMany({
      where: { reason: { contains: "integ_abs_" } },
    });
    await harness.cleanupFixturesByTag(testTag);
  });

  after(async () => {
    await harness.cleanupFixturesByTag(testTag);
    await harness.stop();
  });

  describe("Daily Reports (/daily-reports)", () => {
    it("GET /daily-reports - should return list of daily reports with HTTP 200", async () => {
      const res = await harness.get("/daily-reports", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("GET /daily-reports/calendar - should return calendar report events with HTTP 200", async () => {
      const res = await harness.get("/daily-reports/calendar", {
        token: internToken,
        query: { month: 10, year: 2026 },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe("Weekly Evaluations (/weekly-evaluations)", () => {
    it("GET /weekly-evaluations - should return weekly evaluations with HTTP 200", async () => {
      const res = await harness.get("/weekly-evaluations", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });
  });

  describe("Meetings Management (/meetings)", () => {
    it("GET /meetings - should return meetings list with HTTP 200", async () => {
      const res = await harness.get("/meetings", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /meetings/busy-users - should query busy users schedule with HTTP 200", async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 90000000).toISOString();
      const res = await harness.get("/meetings/busy-users", {
        token: adminToken,
        query: { startTime, endTime },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe("Absence Requests Lifecycle (/absences)", () => {
    it("GET /absences - should return absences list with HTTP 200", async () => {
      const res = await harness.get("/absences", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("POST /absences - should create a new absence request with HTTP 201", async () => {
      const dayOffset = 30 + Math.floor(Math.random() * 200);
      const startDate = new Date(Date.now() + dayOffset * 86400000).toISOString().split("T")[0];
      const endDate = new Date(Date.now() + (dayOffset + 1) * 86400000).toISOString().split("T")[0];

      const res = await harness.post(
        "/absences",
        {
          startDate,
          endDate,
          reasonType: "PERSONAL",
          reason: `Personal leave reason for integration test ${testTag}`,
          durationUnit: "FULL_DAY",
        },
        { token: internToken },
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      createdAbsenceId = res.body.data.id;

      // Verify side effect in Prisma database
      const dbAbsence = await prisma.absence.findUnique({
        where: { id: createdAbsenceId },
      });
      assert.ok(dbAbsence);
      assert.equal(dbAbsence.reason, `Personal leave reason for integration test ${testTag}`);
    });

    it("GET /absences/:id - should retrieve absence request details with HTTP 200", async () => {
      const res = await harness.get(`/absences/${createdAbsenceId}`, {
        token: internToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdAbsenceId);
    });
  });
});
