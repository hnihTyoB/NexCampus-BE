import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requestTaskExtensionSchema,
  rejectTaskExtensionSchema,
  queryExtensionRequestsSchema,
  extensionRequestIdParamSchema,
} from "../src/modules/task-assignments/task-assignment.validation";
import {
  ASSIGNMENT_STATUS,
  EXTENSION_REQUEST_STATUS,
  ACTIVE_CAPACITY_STATUSES,
} from "../src/common/constants/task.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { WeeklyEvaluationAiService } from "../src/modules/weekly-evaluations/weekly-evaluation.ai.service";

describe("Task Deadline Extension Workflow & Evaluation Integration", () => {
  // ─── 1. Constants & Enums ──────────────────────────────────────────────────
  describe("1. Centralized Constants & Error Codes", () => {
    it("should export EXTENSION_PENDING in ASSIGNMENT_STATUS", () => {
      assert.equal(ASSIGNMENT_STATUS.EXTENSION_PENDING, "EXTENSION_PENDING");
      assert.ok(ACTIVE_CAPACITY_STATUSES.includes(ASSIGNMENT_STATUS.EXTENSION_PENDING));
    });

    it("should export EXTENSION_REQUEST_STATUS constants", () => {
      assert.equal(EXTENSION_REQUEST_STATUS.PENDING, "PENDING");
      assert.equal(EXTENSION_REQUEST_STATUS.APPROVED, "APPROVED");
      assert.equal(EXTENSION_REQUEST_STATUS.REJECTED, "REJECTED");
    });

    it("should export extension audit actions and target type", () => {
      assert.equal(AUDIT_ACTION.REQUEST_TASK_EXTENSION, "REQUEST_TASK_EXTENSION");
      assert.equal(AUDIT_ACTION.APPROVE_TASK_EXTENSION, "APPROVE_TASK_EXTENSION");
      assert.equal(AUDIT_ACTION.REJECT_TASK_EXTENSION, "REJECT_TASK_EXTENSION");
      assert.equal(AUDIT_TARGET_TYPE.TASK_EXTENSION_REQUEST, "TASK_EXTENSION_REQUEST");
    });

    it("should export extension error codes", () => {
      assert.equal(ERROR_CODE.EXTENSION_ALREADY_PENDING, "EXTENSION_ALREADY_PENDING");
      assert.equal(ERROR_CODE.EXTENSION_REQUEST_NOT_FOUND, "EXTENSION_REQUEST_NOT_FOUND");
    });
  });

  // ─── 2. Validation Schemas ─────────────────────────────────────────────────
  describe("2. Extension Request Validation Schemas", () => {
    it("should validate a valid extension request payload", () => {
      const payload = {
        proposedDeadline: "2026-10-15T18:00:00.000Z",
        extensionDays: 3,
        reason: "Cần thêm thời gian để tích hợp cổng thanh toán VNPay và kiểm thử",
        commitmentPlan: "Tập trung hoàn thành trước ngày 15/10 và viết test cover 90%",
      };
      const result = requestTaskExtensionSchema.safeParse(payload);
      assert.ok(result.success);
      if (result.success) {
        assert.equal(result.data.extensionDays, 3);
        assert.equal(result.data.reason, payload.reason);
      }
    });

    it("should reject extensionDays less than 1 or greater than 90", () => {
      const invalidLow = requestTaskExtensionSchema.safeParse({
        proposedDeadline: "2026-10-15",
        extensionDays: 0,
        reason: "Lý do hợp lệ đủ 5 ký tự",
        commitmentPlan: "Kế hoạch cam kết hợp lệ",
      });
      assert.ok(!invalidLow.success);

      const invalidHigh = requestTaskExtensionSchema.safeParse({
        proposedDeadline: "2026-10-15",
        extensionDays: 91,
        reason: "Lý do hợp lệ đủ 5 ký tự",
        commitmentPlan: "Kế hoạch cam kết hợp lệ",
      });
      assert.ok(!invalidHigh.success);
    });

    it("should reject short reason or short commitment plan (< 5 chars)", () => {
      const invalidReason = requestTaskExtensionSchema.safeParse({
        proposedDeadline: "2026-10-15",
        extensionDays: 2,
        reason: "kẹt",
        commitmentPlan: "Kế hoạch cam kết hợp lệ",
      });
      assert.ok(!invalidReason.success);

      const invalidPlan = requestTaskExtensionSchema.safeParse({
        proposedDeadline: "2026-10-15",
        extensionDays: 2,
        reason: "Lý do hợp lệ đủ ký tự",
        commitmentPlan: "làm",
      });
      assert.ok(!invalidPlan.success);
    });

    it("should validate rejectTaskExtensionSchema requires non-empty reason", () => {
      const valid = rejectTaskExtensionSchema.safeParse({
        rejectionReason: "Khối lượng công việc có thể hoàn thành đúng hạn nếu chia nhỏ",
      });
      assert.ok(valid.success);

      const empty = rejectTaskExtensionSchema.safeParse({
        rejectionReason: "   ",
      });
      assert.ok(!empty.success);
    });

    it("should validate extensionRequestIdParamSchema with valid UUID", () => {
      const valid = extensionRequestIdParamSchema.safeParse({
        requestId: "01918342-9999-7000-8000-000000000001",
      });
      assert.ok(valid.success);

      const invalid = extensionRequestIdParamSchema.safeParse({
        requestId: "not-a-uuid",
      });
      assert.ok(!invalid.success);
    });

    it("should validate queryExtensionRequestsSchema pagination and filters", () => {
      const result = queryExtensionRequestsSchema.safeParse({
        status: "PENDING",
        page: "2",
        limit: "15",
      });
      assert.ok(result.success);
      if (result.success) {
        assert.equal(result.data.status, "PENDING");
        assert.equal(result.data.page, 2);
        assert.equal(result.data.limit, 15);
      }
    });
  });

  // ─── 3. AI Weekly Evaluation Heuristic Integration ─────────────────────────
  describe("3. Weekly Evaluation AI Scoring Integration", () => {
    const aiService = new WeeklyEvaluationAiService();
    const weekRange = {
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-10-07T23:59:59Z"),
    };

    it("should deduct progressRequirement when intern has extension requests", () => {
      const dailyReports = [
        { date: new Date("2026-10-01"), hoursWorked: 8, content: "Làm task A", blockers: null },
        { date: new Date("2026-10-02"), hoursWorked: 8, content: "Làm task A", blockers: null },
        { date: new Date("2026-10-03"), hoursWorked: 8, content: "Làm task A", blockers: null },
        { date: new Date("2026-10-04"), hoursWorked: 8, content: "Làm task A", blockers: null },
        { date: new Date("2026-10-05"), hoursWorked: 8, content: "Làm task A", blockers: null },
      ];
      const taskSubmissions = [
        { reviewStatus: "APPROVED", attempt: 1, assignment: { task: { title: "API Payment" } } },
      ];

      // Without extension: perfect progress should be TOT
      const evalNormal = aiService.evaluateHeuristic(
        "Nguyễn Văn A",
        1,
        weekRange,
        dailyReports,
        taskSubmissions,
        [], // no week extensions
        [], // no internship extensions
      );
      assert.equal(evalNormal.ratings.progressRequirement, "TOT");

      // With 1 extension in week: progressRequirement is adjusted down from TOT to KHA
      const evalWithOneExt = aiService.evaluateHeuristic(
        "Nguyễn Văn A",
        1,
        weekRange,
        dailyReports,
        taskSubmissions,
        [{ id: "ext-1", extensionDays: 2 }],
        [{ id: "ext-1", extensionDays: 2 }],
      );
      assert.equal(evalWithOneExt.ratings.progressRequirement, "KHA");
      assert.ok(
        evalWithOneExt.weaknesses.some((w) => w.includes("xin gia hạn deadline")),
        "Weaknesses should explicitly mention deadline extension",
      );
      assert.ok(
        evalWithOneExt.recommendations.some((r) => r.includes("gia hạn")),
        "Recommendations should advise against late extension requests",
      );

      // With 2+ extensions: progressRequirement is adjusted down to TB
      const evalWithMultipleExt = aiService.evaluateHeuristic(
        "Nguyễn Văn A",
        1,
        weekRange,
        dailyReports,
        taskSubmissions,
        [
          { id: "ext-1", extensionDays: 2 },
          { id: "ext-2", extensionDays: 3 },
        ],
        [
          { id: "ext-1", extensionDays: 2 },
          { id: "ext-2", extensionDays: 3 },
          { id: "ext-3", extensionDays: 1 },
        ],
      );
      assert.equal(evalWithMultipleExt.ratings.progressRequirement, "TB");
      assert.equal(evalWithMultipleExt.ratings.workAttitude, "KHA");
      assert.equal(evalWithMultipleExt.dataUsed.extensionRequestsCount, 2);
      assert.equal(evalWithMultipleExt.dataUsed.totalInternshipExtensions, 3);
    });
  });
});
