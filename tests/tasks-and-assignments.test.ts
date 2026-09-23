import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskGroupSchema,
  updateTaskGroupSchema,
  queryTaskGroupSchema,
} from "../src/modules/task-groups/task-group.validation";
import {
  createTaskSchema,
  updateTaskSchema,
  findAllTaskSchema,
  taskAnalyticsQuerySchema,
  getAttachmentUploadUrlSchema,
  confirmAttachmentUploadSchema,
  createLinkAttachmentSchema,
} from "../src/modules/tasks/task.validation";
import {
  createAssignmentSchema,
  assignTaskSchema,
  updateAssignmentSchema,
  rejectAssignmentSchema,
  findAllAssignmentSchema,
} from "../src/modules/task-assignments/task-assignment.validation";
import {
  TASK_PRIORITY,
  ASSIGNMENT_STATUS,
  TASK_GROUP_STATUS,
  ASSIGNMENT_ROLE,
  SUPPORT_WORKLOAD_FACTOR,
  DEFAULT_MAX_WORKLOAD_DAYS,
  DEFAULT_TASK_DAYS,
} from "../src/common/constants/task.constant";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { AppError } from "../src/common/errors/app-error";
import { TaskService } from "../src/modules/tasks/task.service";
import { TaskAssignmentService } from "../src/modules/task-assignments/task-assignment.service";

describe("Task Management & Assignment Suite (task-groups, tasks, task-assignments)", () => {
  // ─── 1. Constants & Error Codes ───────────────────────────────────────────

  describe("1. Centralized Constants & Error Codes", () => {
    it("should export TASK_ALREADY_COMPLETED error code", () => {
      assert.equal(ERROR_CODE.TASK_ALREADY_COMPLETED, "TASK_ALREADY_COMPLETED");
    });

    it("should export all Task Priority constants", () => {
      assert.equal(TASK_PRIORITY.LOW, "LOW");
      assert.equal(TASK_PRIORITY.MEDIUM, "MEDIUM");
      assert.equal(TASK_PRIORITY.HIGH, "HIGH");
    });

    it("should export all Assignment Status constants", () => {
      assert.equal(ASSIGNMENT_STATUS.PENDING_APPROVAL, "PENDING_APPROVAL");
      assert.equal(ASSIGNMENT_STATUS.TODO, "TODO");
      assert.equal(ASSIGNMENT_STATUS.IN_PROGRESS, "IN_PROGRESS");
      assert.equal(ASSIGNMENT_STATUS.REVIEW, "REVIEW");
      assert.equal(ASSIGNMENT_STATUS.DONE, "DONE");
      assert.equal(ASSIGNMENT_STATUS.BLOCKED, "BLOCKED");
    });

    it("should export all Task Group Status constants", () => {
      assert.equal(TASK_GROUP_STATUS.ACTIVE, "ACTIVE");
      assert.equal(TASK_GROUP_STATUS.COMPLETED, "COMPLETED");
      assert.equal(TASK_GROUP_STATUS.ARCHIVED, "ARCHIVED");
    });

    it("should export proper Workload Calculation factors", () => {
      assert.equal(SUPPORT_WORKLOAD_FACTOR, 0.5);
      assert.equal(DEFAULT_MAX_WORKLOAD_DAYS, 10);
      assert.equal(DEFAULT_TASK_DAYS, 3);
      assert.equal(ASSIGNMENT_ROLE.OWNER, "OWNER");
      assert.equal(ASSIGNMENT_ROLE.SUPPORT, "SUPPORT");
    });

    it("should define required Dynamic RBAC permissions", () => {
      assert.equal(PERMISSIONS.TASK_GROUP_READ, "TASK_GROUP_READ");
      assert.equal(PERMISSIONS.TASK_GROUP_CREATE, "TASK_GROUP_CREATE");
      assert.equal(PERMISSIONS.TASK_GROUP_UPDATE, "TASK_GROUP_UPDATE");
      assert.equal(PERMISSIONS.TASK_GROUP_DELETE, "TASK_GROUP_DELETE");

      assert.equal(PERMISSIONS.TASK_READ, "TASK_READ");
      assert.equal(PERMISSIONS.TASK_CREATE, "TASK_CREATE");
      assert.equal(PERMISSIONS.TASK_UPDATE, "TASK_UPDATE");
      assert.equal(PERMISSIONS.TASK_DELETE, "TASK_DELETE");
      assert.equal(PERMISSIONS.TASK_ATTACHMENT_UPLOAD, "TASK_ATTACHMENT_UPLOAD");
      assert.equal(PERMISSIONS.TASK_ATTACHMENT_DELETE, "TASK_ATTACHMENT_DELETE");

      assert.equal(PERMISSIONS.TASK_ASSIGNMENT_READ, "TASK_ASSIGNMENT_READ");
      assert.equal(PERMISSIONS.TASK_ASSIGNMENT_CREATE, "TASK_ASSIGNMENT_CREATE");
      assert.equal(PERMISSIONS.TASK_ASSIGNMENT_UPDATE, "TASK_ASSIGNMENT_UPDATE");
      assert.equal(PERMISSIONS.TASK_ASSIGNMENT_DELETE, "TASK_ASSIGNMENT_DELETE");
      assert.equal(PERMISSIONS.TASK_ASSIGNMENT_APPROVE, "TASK_ASSIGNMENT_APPROVE");
    });

    it("should define required Audit Log Actions and Target Types", () => {
      assert.equal(AUDIT_ACTION.CREATE_TASK_GROUP, "CREATE_TASK_GROUP");
      assert.equal(AUDIT_ACTION.CREATE_TASK, "CREATE_TASK");
      assert.equal(AUDIT_ACTION.ASSIGN_TASK, "ASSIGN_TASK");
      assert.equal(AUDIT_ACTION.APPROVE_TASK_ASSIGNMENT, "APPROVE_TASK_ASSIGNMENT");
      assert.equal(AUDIT_ACTION.REJECT_TASK_ASSIGNMENT, "REJECT_TASK_ASSIGNMENT");

      assert.equal(AUDIT_TARGET_TYPE.TASK_GROUP, "TASK_GROUP");
      assert.equal(AUDIT_TARGET_TYPE.TASK, "TASK");
      assert.equal(AUDIT_TARGET_TYPE.TASK_ASSIGNMENT, "TASK_ASSIGNMENT");
      assert.equal(AUDIT_TARGET_TYPE.TASK_ATTACHMENT, "TASK_ATTACHMENT");
    });
  });

  // ─── 2. Task Group Validation ─────────────────────────────────────────────

  describe("2. Task Group Validation & Membership Schemas", () => {
    it("should accept valid createTaskGroupSchema with members", () => {
      const parsed = createTaskGroupSchema.safeParse({
        name: "Backend Core Team",
        description: "Core BE tasks for sprint 1",
        departmentId: "11111111-1111-1111-1111-111111111111",
        status: "ACTIVE",
        memberIds: ["22222222-2222-2222-2222-222222222222"],
        maxWorkloadDays: 12,
        maxActiveTasks: 4,
        requireAllMembers: true,
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.name, "Backend Core Team");
        assert.equal(parsed.data.maxWorkloadDays, 12);
        assert.equal(parsed.data.maxActiveTasks, 4);
        assert.equal(parsed.data.status, "ACTIVE");
      }
    });

    it("should reject empty name in createTaskGroupSchema", () => {
      const parsed = createTaskGroupSchema.safeParse({
        name: "   ",
      });
      assert.equal(parsed.success, false);
    });

    it("should coerce pagination in queryTaskGroupSchema", () => {
      const parsed = queryTaskGroupSchema.safeParse({
        page: "3",
        limit: "25",
        status: "ACTIVE",
        search: "Backend",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 3);
        assert.equal(parsed.data.limit, 25);
        assert.equal(parsed.data.search, "Backend");
      }
    });
  });

  // ─── 3. Task Validation & Priority Mappings ───────────────────────────────

  describe("3. Task Validation & Priority Mappings", () => {
    it("should map P0 to HIGH priority", () => {
      const parsed = createTaskSchema.safeParse({
        title: "Build Authentication API",
        deadline: "2026-10-15T00:00:00.000Z",
        estDays: 3,
        priority: "P0",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.priority, "HIGH");
      }
    });

    it("should map P1 to MEDIUM and P2 to LOW priority", () => {
      const parsedP1 = createTaskSchema.safeParse({
        title: "Build Notifications API",
        deadline: "2026-10-15T00:00:00.000Z",
        estDays: 2,
        priority: "P1",
      });
      assert.equal(parsedP1.success, true);
      if (parsedP1.success) {
        assert.equal(parsedP1.data.priority, "MEDIUM");
      }

      const parsedP2 = createTaskSchema.safeParse({
        title: "Clean docs",
        deadline: "2026-10-15T00:00:00.000Z",
        estDays: 1,
        priority: "P2",
      });
      assert.equal(parsedP2.success, true);
      if (parsedP2.success) {
        assert.equal(parsedP2.data.priority, "LOW");
      }
    });

    it("should accept standard LOW, MEDIUM, HIGH priorities", () => {
      const parsed = createTaskSchema.safeParse({
        title: "Standard Task",
        deadline: "2026-10-15T00:00:00.000Z",
        estDays: 4,
        priority: "HIGH",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.priority, "HIGH");
      }
    });

    it("should reject invalid deadline string", () => {
      const parsed = createTaskSchema.safeParse({
        title: "Bad Date Task",
        deadline: "not-a-valid-date",
        estDays: 2,
      });
      assert.equal(parsed.success, false);
    });

    it("should coerce query parameters in findAllTaskSchema", () => {
      const parsed = findAllTaskSchema.safeParse({
        page: "2",
        limit: "50",
        priority: "P0",
        status: "TODO",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 50);
        assert.equal(parsed.data.priority, "HIGH");
        assert.equal(parsed.data.status, "TODO");
      }
    });
  });

  // ─── 4. Task Assignment Validation & Roles ────────────────────────────────

  describe("4. Task Assignment Validation & Role Constraints", () => {
    it("should accept valid createAssignmentSchema with distinct owner and support", () => {
      const parsed = createAssignmentSchema.safeParse({
        taskId: "11111111-1111-1111-1111-111111111111",
        internId: "22222222-2222-2222-2222-222222222222",
        supportId: "33333333-3333-3333-3333-333333333333",
        internEmail: "intern@nexcampus.edu.vn",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject assignment when Owner and Support are identical", () => {
      const parsed = createAssignmentSchema.safeParse({
        taskId: "11111111-1111-1111-1111-111111111111",
        internId: "22222222-2222-2222-2222-222222222222",
        supportId: "22222222-2222-2222-2222-222222222222",
      });
      assert.equal(parsed.success, false);
    });

    it("should enforce blockedReason when status is BLOCKED", () => {
      const withoutReason = updateAssignmentSchema.safeParse({
        status: "BLOCKED",
      });
      assert.equal(withoutReason.success, false);

      const withReason = updateAssignmentSchema.safeParse({
        status: "BLOCKED",
        blockedReason: "Waiting for database schema migration",
      });
      assert.equal(withReason.success, true);
    });

    it("should reject blockedReason when status is not BLOCKED", () => {
      const parsed = updateAssignmentSchema.safeParse({
        status: "IN_PROGRESS",
        blockedReason: "Unnecessary reason",
      });
      assert.equal(parsed.success, false);
    });
  });

  // ─── 5. Task Locking Constraint (DONE -> TASK_ALREADY_COMPLETED) ──────────

  describe("5. Task Completed Locking Constraint (TASK_ALREADY_COMPLETED)", () => {
    it("should throw AppError 409 TASK_ALREADY_COMPLETED when checking editable task with DONE assignment", async () => {
      const service = new TaskService();

      // Mock repository returning a task whose assignment is DONE
      (service as any).repository = {
        findById: async (id: string) => ({
          id,
          title: "Completed Task",
          assignment: { status: ASSIGNMENT_STATUS.DONE },
        }),
      };

      try {
        await service.findEditableTask("some-task-id");
        assert.fail("Should have thrown AppError");
      } catch (err) {
        assert(err instanceof AppError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.TASK_ALREADY_COMPLETED);
        assert.equal(err.message, "Completed tasks cannot be edited");
      }
    });

    it("should throw AppError 409 TASK_ALREADY_COMPLETED when updating assignment with DONE status", async () => {
      const service = new TaskAssignmentService();

      // Mock repository returning an assignment whose status is DONE
      (service as any).repository = {
        findById: async (id: string) => ({
          id,
          status: ASSIGNMENT_STATUS.DONE,
          intern: { leaderId: "leader-1" },
        }),
      };

      try {
        await service.update(
          "assignment-done-id",
          { status: ASSIGNMENT_STATUS.IN_PROGRESS },
          "leader-1",
          "LEADER",
        );
        assert.fail("Should have thrown AppError");
      } catch (err) {
        assert(err instanceof AppError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.TASK_ALREADY_COMPLETED);
      }
    });

    it("should throw AppError 409 TASK_ALREADY_COMPLETED when deleting assignment with DONE status", async () => {
      const service = new TaskAssignmentService();

      (service as any).repository = {
        findById: async (id: string) => ({
          id,
          status: ASSIGNMENT_STATUS.DONE,
          intern: { leaderId: "leader-1" },
          assignedBy: "leader-1",
        }),
      };

      try {
        await service.delete("assignment-done-id", "leader-1", "LEADER");
        assert.fail("Should have thrown AppError");
      } catch (err) {
        assert(err instanceof AppError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.TASK_ALREADY_COMPLETED);
      }
    });

    it("should allow editing when assignment status is TODO or IN_PROGRESS", async () => {
      const service = new TaskService();

      (service as any).repository = {
        findById: async (id: string) => ({
          id,
          title: "In-Progress Task",
          assignment: { status: ASSIGNMENT_STATUS.IN_PROGRESS },
        }),
      };

      const task = await service.findEditableTask("active-task-id");
      assert.equal(task.id, "active-task-id");
      assert.equal(task.assignment.status, "IN_PROGRESS");
    });
  });

  // ─── 6. Capacity Calculation Logic ────────────────────────────────────────

  describe("6. Capacity & Workload Calculation Logic", () => {
    it("should calculate Owner at 100% and Support at 50% workload factor", () => {
      const taskEstDays = 4;
      const ownerWorkload = taskEstDays * 1.0;
      const supportWorkload = taskEstDays * SUPPORT_WORKLOAD_FACTOR;

      assert.equal(ownerWorkload, 4);
      assert.equal(supportWorkload, 2);
    });

    it("should sum combined workload of multiple tasks accurately", () => {
      const assignments = [
        { role: "OWNER", estDays: 3 },    // 3 days
        { role: "SUPPORT", estDays: 4 },  // 2 days
        { role: "OWNER", estDays: 2 },    // 2 days
      ];

      const totalWorkload = assignments.reduce((acc, curr) => {
        const factor = curr.role === "OWNER" ? 1.0 : SUPPORT_WORKLOAD_FACTOR;
        return acc + curr.estDays * factor;
      }, 0);

      assert.equal(totalWorkload, 7);
    });
  });

  // ─── 7. Attachments Validation & Prefix ────────────────────────────────────

  describe("7. Task Attachments Validation & R2 Prefix", () => {
    it("should validate getAttachmentUploadUrlSchema correctly", () => {
      const parsed = getAttachmentUploadUrlSchema.safeParse({
        fileName: "architecture-diagram.png",
        contentType: "image/png",
        fileSize: 102400,
      });
      assert.equal(parsed.success, true);
    });

    it("should validate confirmAttachmentUploadSchema with required fields", () => {
      const parsed = confirmAttachmentUploadSchema.safeParse({
        filePath: "tasks/task-123/uuid_architecture.png",
        fileName: "architecture.png",
        mimeType: "image/png",
        fileSize: 102400,
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert(parsed.data.filePath.startsWith("tasks/"));
      }
    });

    it("should validate createLinkAttachmentSchema with valid URL", () => {
      const valid = createLinkAttachmentSchema.safeParse({
        fileName: "Pull Request #42",
        fileUrl: "https://github.com/NexCampus/repo/pull/42",
      });
      assert.equal(valid.success, true);

      const invalid = createLinkAttachmentSchema.safeParse({
        fileName: "Bad Link",
        fileUrl: "not-a-url",
      });
      assert.equal(invalid.success, false);
    });
  });

  // ─── 8. Schedule Validation (startDate <= deadline) ───────────────────────

  describe("8. Schedule Boundary Guard", () => {
    it("should reject task creation when startDate > deadline", async () => {
      const service = new TaskService();

      try {
        await service.create(
          {
            title: "Impossible Schedule",
            startDate: "2026-10-20T00:00:00.000Z",
            deadline: "2026-10-10T00:00:00.000Z",
            estDays: 2,
          },
          "user-1",
        );
        assert.fail("Should have thrown AppError");
      } catch (err) {
        assert(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
        assert.equal(err.message, "Start date must be on or before deadline");
      }
    });

    it("should allow task creation when startDate <= deadline", async () => {
      const service = new TaskService();

      (service as any).repository = {
        findByCode: async () => null,
        create: async (data: any, createdBy: string) => ({
          id: "created-task-1",
          ...data,
          createdBy,
        }),
        createAuditLog: async () => {},
      };

      const result = await service.create(
        {
          title: "Valid Schedule",
          startDate: "2026-10-01T00:00:00.000Z",
          deadline: "2026-10-10T00:00:00.000Z",
          estDays: 5,
        },
        "user-1",
      );

      assert.equal(result.id, "created-task-1");
      assert.equal(result.title, "Valid Schedule");
    });
  });

  // ─── 9. Task Analytics Query Validation ────────────────────────────────────

  describe("9. Task Analytics Query Validation", () => {
    it("should accept valid dateFrom and dateTo ISO strings", () => {
      const parsed = taskAnalyticsQuerySchema.safeParse({
        dateFrom: "2026-08-31T17:00:00.000Z",
        dateTo: "2026-09-30T16:59:59.999Z",
      });
      assert.equal(parsed.success, true);
    });

    it("should accept valid taskGroupId UUID", () => {
      const parsed = taskAnalyticsQuerySchema.safeParse({
        taskGroupId: "11111111-1111-1111-1111-111111111111",
        dateFrom: "2026-08-31T17:00:00.000Z",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject invalid date strings in dateFrom", () => {
      const parsed = taskAnalyticsQuerySchema.safeParse({
        dateFrom: "not-a-date",
      });
      assert.equal(parsed.success, false);
    });

    it("should reject invalid taskGroupId that is not a UUID", () => {
      const parsed = taskAnalyticsQuerySchema.safeParse({
        taskGroupId: "invalid-uuid",
      });
      assert.equal(parsed.success, false);
    });
  });
});
