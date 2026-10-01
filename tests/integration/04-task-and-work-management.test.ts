import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./setup/test-harness";
import { prisma } from "../../src/database/prisma.client";

describe("INTEGRATION: Task & Work Management Modules", () => {
  const testTag = `integ_tsk_${Date.now()}`;
  let adminToken = "";
  let leaderToken = "";
  let internToken = "";
  let createdGroupId = "";
  let createdTaskId = "";

  before(async () => {
    await harness.start();
    adminToken = await harness.getAdminToken();
    leaderToken = await harness.getLeaderToken();
    internToken = await harness.getInternToken();
    await harness.cleanupFixturesByTag(testTag);
  });

  after(async () => {
    await harness.cleanupFixturesByTag(testTag);
    await harness.stop();
  });

  describe("Task Groups Lifecycle (/task-groups)", () => {
    it("GET /task-groups - should list task groups with HTTP 200", async () => {
      const res = await harness.get("/task-groups", { token: adminToken });
      assert.equal(res.status, 200);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("POST /task-groups - should create a new task group with HTTP 201", async () => {
      const res = await harness.post(
        "/task-groups",
        {
          name: `Task Group ${testTag}`,
          description: `Integration test task group ${testTag}`,
        },
        { token: adminToken },
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      createdGroupId = res.body.data.id;

      // Verify in DB via Prisma
      const dbGroup = await prisma.taskGroup.findUnique({
        where: { id: createdGroupId },
      });
      assert.ok(dbGroup);
      assert.equal(dbGroup.name, `Task Group ${testTag}`);
    });

    it("GET /task-groups/:id - should retrieve task group details with HTTP 200", async () => {
      const res = await harness.get(`/task-groups/${createdGroupId}`, {
        token: adminToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdGroupId);
    });
  });

  describe("Tasks Lifecycle (/tasks)", () => {
    it("GET /tasks - should list tasks with HTTP 200", async () => {
      const res = await harness.get("/tasks", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items || res.body.data));
    });

    it("POST /tasks - should create a new task with HTTP 201", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await harness.post(
        "/tasks",
        {
          title: `Task Title ${testTag}`,
          description: `Task description for integration test ${testTag}`,
          deadline: futureDate,
          estDays: 3,
          priority: "MEDIUM",
          taskGroupId: createdGroupId,
        },
        { token: adminToken },
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      createdTaskId = res.body.data.id;

      // Assert DB state directly
      const dbTask = await prisma.task.findUnique({
        where: { id: createdTaskId },
      });
      assert.ok(dbTask);
      assert.equal(dbTask.title, `Task Title ${testTag}`);
    });

    it("GET /tasks/:id - should get task detail by id with HTTP 200", async () => {
      const res = await harness.get(`/tasks/${createdTaskId}`, {
        token: adminToken,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdTaskId);
    });
  });

  describe("Task Assignments & Submissions (/task-assignments, /task-submissions)", () => {
    it("GET /task-assignments - should list assignments with HTTP 200", async () => {
      const res = await harness.get("/task-assignments", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });

    it("GET /task-submissions - should list submissions with HTTP 200", async () => {
      const res = await harness.get("/task-submissions", { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.data || res.body.data?.items);
      assert.ok(Array.isArray(items));
    });
  });
});
