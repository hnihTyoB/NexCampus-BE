import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
  SYSTEM_TARGET_ID,
} from "../src/common/constants/audit-log.constant";
import {
  ASSIGNMENT_STATUS,
} from "../src/common/constants/task.constant";
import { AppError } from "../src/common/errors/app-error";
import { blockTaskSchema } from "../src/modules/task-assignments/task-assignment.validation";
import { TaskAssignmentService } from "../src/modules/task-assignments/task-assignment.service";
import {
  createSubmissionSchema,
  reviewSubmissionSchema,
  getSubmissionUploadUrlSchema,
} from "../src/modules/task-submissions/task-submission.validation";
import { TaskSubmissionService } from "../src/modules/task-submissions/task-submission.service";
import {
  createMeetingSchema,
  updateMeetingSchema,
  getBusyUsersSchema,
  submitAbsenceSchema,
  reviewAbsenceSchema,
} from "../src/modules/meetings/meeting.validation";
import { MeetingService } from "../src/modules/meetings/meeting.service";
import {
  createAbsenceSchema,
  reviewGeneralAbsenceSchema,
} from "../src/modules/absences/absence.validation";
import { AbsenceService } from "../src/modules/absences/absence.service";
import { ReviewStatus, MeetingStatus, MeetingType, AbsenceStatus } from "@prisma/client";

describe("Submissions, Lifecycle Actions & Meetings/Absences Suite", () => {
  // ─── 1. Constants & Error Codes ───────────────────────────────────────────

  describe("1. Error Codes, Constants & Permissions", () => {
    it("should export new error codes correctly", () => {
      assert.equal(ERROR_CODE.TASK_NOT_IN_PROGRESS, "TASK_NOT_IN_PROGRESS");
      assert.equal(ERROR_CODE.INVALID_STATUS_TRANSITION, "INVALID_STATUS_TRANSITION");
      assert.equal(ERROR_CODE.SUBMISSION_NOT_FOUND, "SUBMISSION_NOT_FOUND");
      assert.equal(ERROR_CODE.SUBMISSION_ALREADY_REVIEWED, "SUBMISSION_ALREADY_REVIEWED");
      assert.equal(ERROR_CODE.SUBMISSION_CANNOT_EDIT, "SUBMISSION_CANNOT_EDIT");
      assert.equal(ERROR_CODE.MEETING_NOT_FOUND, "MEETING_NOT_FOUND");
      assert.equal(ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED, "MEETING_COMPLETED_OR_CANCELLED");
      assert.equal(ERROR_CODE.NOT_MEETING_PARTICIPANT, "NOT_MEETING_PARTICIPANT");
      assert.equal(ERROR_CODE.ABSENCE_NOT_FOUND, "ABSENCE_NOT_FOUND");
      assert.equal(ERROR_CODE.ABSENCE_ALREADY_SUBMITTED, "ABSENCE_ALREADY_SUBMITTED");
      assert.equal(ERROR_CODE.ABSENCE_ALREADY_REVIEWED, "ABSENCE_ALREADY_REVIEWED");
      assert.equal(ERROR_CODE.INVALID_DATE_RANGE, "INVALID_DATE_RANGE");
    });

    it("should export permissions for task submissions, meetings and absences", () => {
      assert.equal(PERMISSIONS.TASK_SUBMISSION_READ, "TASK_SUBMISSION_READ");
      assert.equal(PERMISSIONS.TASK_SUBMISSION_CREATE, "TASK_SUBMISSION_CREATE");
      assert.equal(PERMISSIONS.TASK_SUBMISSION_REVIEW, "TASK_SUBMISSION_REVIEW");
      assert.equal(PERMISSIONS.MEETING_READ, "MEETING_READ");
      assert.equal(PERMISSIONS.MEETING_CREATE, "MEETING_CREATE");
      assert.equal(PERMISSIONS.MEETING_UPDATE, "MEETING_UPDATE");
      assert.equal(PERMISSIONS.MEETING_ATTEND, "MEETING_ATTEND");
      assert.equal(PERMISSIONS.MEETING_ABSENCE_SUBMIT, "MEETING_ABSENCE_SUBMIT");
      assert.equal(PERMISSIONS.MEETING_ABSENCE_REVIEW, "MEETING_ABSENCE_REVIEW");
      assert.equal(PERMISSIONS.ABSENCE_READ, "ABSENCE_READ");
      assert.equal(PERMISSIONS.ABSENCE_CREATE, "ABSENCE_CREATE");
      assert.equal(PERMISSIONS.ABSENCE_REVIEW, "ABSENCE_REVIEW");
    });

    it("should export audit action and target types", () => {
      assert.equal(AUDIT_ACTION.START_TASK, "START_TASK");
      assert.equal(AUDIT_ACTION.BLOCK_TASK, "BLOCK_TASK");
      assert.equal(AUDIT_ACTION.UNBLOCK_TASK, "UNBLOCK_TASK");
      assert.equal(AUDIT_ACTION.CREATE_SUBMISSION, "CREATE_SUBMISSION");
      assert.equal(AUDIT_ACTION.REVIEW_SUBMISSION, "REVIEW_SUBMISSION");
      assert.equal(AUDIT_ACTION.CREATE_MEETING, "CREATE_MEETING");
      assert.equal(AUDIT_ACTION.SUBMIT_ABSENCE, "SUBMIT_ABSENCE");
      assert.equal(AUDIT_ACTION.REVIEW_ABSENCE, "REVIEW_ABSENCE");
      assert.equal(AUDIT_ACTION.CREATE_GENERAL_ABSENCE, "CREATE_GENERAL_ABSENCE");
      assert.equal(AUDIT_ACTION.REVIEW_GENERAL_ABSENCE, "REVIEW_GENERAL_ABSENCE");

      assert.equal(AUDIT_TARGET_TYPE.TASK_SUBMISSION, "TASK_SUBMISSION");
      assert.equal(AUDIT_TARGET_TYPE.SUBMISSION_ATTACHMENT, "SUBMISSION_ATTACHMENT");
      assert.equal(AUDIT_TARGET_TYPE.MEETING, "MEETING");
      assert.equal(AUDIT_TARGET_TYPE.ABSENCE_REQUEST, "ABSENCE_REQUEST");
      assert.equal(AUDIT_TARGET_TYPE.ABSENCE, "ABSENCE");
      assert.equal(SYSTEM_TARGET_ID, "SYSTEM");
    });
  });

  // ─── 2. Task Assignment Lifecycle Actions ─────────────────────────────────

  describe("2. Task Assignment Lifecycle Actions (start, block, unblock)", () => {
    const service = new TaskAssignmentService();

    it("should validate blockTaskSchema requires non-empty blockedReason", () => {
      const valid = blockTaskSchema.safeParse({ blockedReason: "Bị kẹt DB permission" });
      assert.equal(valid.success, true);

      const empty = blockTaskSchema.safeParse({ blockedReason: "   " });
      assert.equal(empty.success, false);

      const missing = blockTaskSchema.safeParse({});
      assert.equal(missing.success, false);
    });

    it("startTask should throw INVALID_STATUS_TRANSITION when task status is not TODO", async () => {
      // Mock findById
      const originalFindById = (service as any).findById;
      (service as any).findById = async () => ({
        id: "a1",
        taskId: "t1",
        status: ASSIGNMENT_STATUS.IN_PROGRESS,
      });

      await assert.rejects(
        async () => {
          await service.startTask("a1", { id: "u1", role: "INTERN" });
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_STATUS_TRANSITION);
          return true;
        },
      );

      (service as any).findById = originalFindById;
    });

    it("startTask should throw TASK_ALREADY_COMPLETED when task is already DONE", async () => {
      const originalFindById = (service as any).findById;
      (service as any).findById = async () => ({
        id: "a1",
        taskId: "t1",
        status: ASSIGNMENT_STATUS.DONE,
      });

      await assert.rejects(
        async () => {
          await service.startTask("a1", { id: "u1", role: "ADMIN" });
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.TASK_ALREADY_COMPLETED);
          return true;
        },
      );

      (service as any).findById = originalFindById;
    });

    it("blockTask should throw INVALID_STATUS_TRANSITION when assignment is in TODO (must be IN_PROGRESS)", async () => {
      const originalFindById = (service as any).findById;
      (service as any).findById = async () => ({
        id: "a1",
        taskId: "t1",
        status: ASSIGNMENT_STATUS.TODO,
      });

      await assert.rejects(
        async () => {
          await service.blockTask("a1", { id: "u1", role: "INTERN" }, "Vướng API");
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_STATUS_TRANSITION);
          return true;
        },
      );

      (service as any).findById = originalFindById;
    });

    it("unblockTask should throw FORBIDDEN when an intern attempts to unblock", async () => {
      const originalFindById = (service as any).findById;
      (service as any).findById = async () => ({
        id: "a1",
        taskId: "t1",
        status: ASSIGNMENT_STATUS.BLOCKED,
        intern: { leaderId: "leader-1" },
      });

      await assert.rejects(
        async () => {
          await service.unblockTask("a1", { id: "intern-1", role: "INTERN" });
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );

      (service as any).findById = originalFindById;
    });

    it("unblockTask should throw INVALID_STATUS_TRANSITION if task is not in BLOCKED status", async () => {
      const originalFindById = (service as any).findById;
      (service as any).findById = async () => ({
        id: "a1",
        taskId: "t1",
        status: ASSIGNMENT_STATUS.IN_PROGRESS,
        intern: { leaderId: "leader-1" },
      });

      await assert.rejects(
        async () => {
          await service.unblockTask("a1", { id: "leader-1", role: "LEADER" });
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_STATUS_TRANSITION);
          return true;
        },
      );

      (service as any).findById = originalFindById;
    });
  });

  // ─── 3. Task Submissions & Attachments ────────────────────────────────────

  describe("3. Task Submissions Validation & Prerequisite Conditions", () => {
    it("should validate createSubmissionSchema correctly", () => {
      const valid = createSubmissionSchema.safeParse({
        assignmentId: "11111111-1111-1111-1111-111111111111",
        prLink: "https://github.com/org/repo/pull/42",
        videoDemo: "https://youtube.com/watch?v=123",
        note: "Nộp bài lần 1 hoàn thiện giao diện",
      });
      assert.equal(valid.success, true);
    });

    it("should accept createSubmissionSchema without optional links", () => {
      const valid = createSubmissionSchema.safeParse({
        assignmentId: "11111111-1111-1111-1111-111111111111",
        note: "Chỉ nộp đính kèm",
      });
      assert.equal(valid.success, true);
    });

    it("should reject invalid assignmentId in createSubmissionSchema", () => {
      const invalid = createSubmissionSchema.safeParse({
        assignmentId: "not-a-uuid",
      });
      assert.equal(invalid.success, false);
    });

    it("should validate getSubmissionUploadUrlSchema", () => {
      const valid = getSubmissionUploadUrlSchema.safeParse({
        fileName: "solution.zip",
        mimeType: "application/zip",
      });
      assert.equal(valid.success, true);

      const empty = getSubmissionUploadUrlSchema.safeParse({
        fileName: "",
        mimeType: "image/png",
      });
      assert.equal(empty.success, false);
    });
  });

  // ─── 4. Task Submission Review Workflow ───────────────────────────────────

  describe("4. Task Submission Review Workflow", () => {
    it("should require reviewComment when reviewStatus is REJECTED", () => {
      const invalid = reviewSubmissionSchema.safeParse({
        reviewStatus: ReviewStatus.REJECTED,
      });
      assert.equal(invalid.success, false);

      const emptyComment = reviewSubmissionSchema.safeParse({
        reviewStatus: ReviewStatus.REJECTED,
        reviewComment: "   ",
      });
      assert.equal(emptyComment.success, false);

      const validRejected = reviewSubmissionSchema.safeParse({
        reviewStatus: ReviewStatus.REJECTED,
        reviewComment: "Cần tối ưu câu truy vấn CSDL và bổ sung unit test",
      });
      assert.equal(validRejected.success, true);
    });

    it("should allow reviewComment to be optional when reviewStatus is APPROVED", () => {
      const validApproved = reviewSubmissionSchema.safeParse({
        reviewStatus: ReviewStatus.APPROVED,
      });
      assert.equal(validApproved.success, true);
    });
  });

  // ─── 5. Cloudflare R2 Upload URL Generation ───────────────────────────────

  describe("5. Cloudflare R2 Upload URL Prefix (submissions/)", () => {
    const submissionService = new TaskSubmissionService();

    it("should generate presigned upload URL with submissions/ prefix", async () => {
      // Mock r2Service
      (submissionService as any).r2Service = {
        getPresignedUploadUrl: async (key: string) => `https://mock-r2.com/${key}?signed=true`,
        getPublicUrl: (key: string) => `https://pub-r2.com/${key}`,
      };

      const result = await submissionService.getUploadUrl(
        "final_submission.pdf",
        "application/pdf",
        { id: "intern-1", role: "INTERN" },
      );

      assert.ok(result.filePath.startsWith("submissions/"));
      assert.ok(result.filePath.includes("final_submission.pdf"));
      assert.ok(result.uploadUrl.includes("submissions/"));
      assert.ok(result.fileUrl.includes("submissions/"));
    });
  });

  // ─── 6. Meetings Validation & Conflict Checking ───────────────────────────

  describe("6. Meetings Validation & Conflict Checking (getBusyUsers)", () => {
    it("should validate createMeetingSchema requires startTime < endTime", () => {
      const valid = createMeetingSchema.safeParse({
        title: "Sprint Planning",
        meetingType: MeetingType.ONLINE,
        startTime: new Date("2026-09-20T09:00:00Z"),
        endTime: new Date("2026-09-20T10:00:00Z"),
      });
      assert.equal(valid.success, true);

      const invalidTime = createMeetingSchema.safeParse({
        title: "Sprint Planning",
        meetingType: MeetingType.ONLINE,
        startTime: new Date("2026-09-20T11:00:00Z"),
        endTime: new Date("2026-09-20T10:00:00Z"),
      });
      assert.equal(invalidTime.success, false);
    });

    it("should validate updateMeetingSchema with partial fields", () => {
      const valid = updateMeetingSchema.safeParse({
        title: "Updated Title",
        status: MeetingStatus.COMPLETED,
        minutes: "Biên bản cuộc họp: thống nhất triển khai module V2",
      });
      assert.equal(valid.success, true);
    });

    it("should validate getBusyUsersSchema", () => {
      const valid = getBusyUsersSchema.safeParse({
        startTime: "2026-09-20T09:00:00Z",
        endTime: "2026-09-20T11:00:00Z",
      });
      assert.equal(valid.success, true);

      const invalid = getBusyUsersSchema.safeParse({
        startTime: "2026-09-20T12:00:00Z",
        endTime: "2026-09-20T10:00:00Z",
      });
      assert.equal(invalid.success, false);
    });

    it("MeetingService should forbid intern from creating meetings", async () => {
      const meetingService = new MeetingService();
      await assert.rejects(
        async () => {
          await meetingService.create(
            {
              title: "Unauthorized Meeting",
              meetingType: MeetingType.ONLINE,
              startTime: new Date("2026-09-20T09:00:00Z"),
              endTime: new Date("2026-09-20T10:00:00Z"),
            },
            { id: "intern-1", role: "INTERN" },
          );
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });
  });

  // ─── 7. Meeting Absence Request ───────────────────────────────────────────

  describe("7. Meeting Absence Request (submit & review)", () => {
    it("should validate submitAbsenceSchema requires reason", () => {
      const valid = submitAbsenceSchema.safeParse({
        reason: "Bận thi học kỳ",
        attachmentUrl: "https://example.com/exam.png",
      });
      assert.equal(valid.success, true);

      const emptyReason = submitAbsenceSchema.safeParse({
        reason: "   ",
      });
      assert.equal(emptyReason.success, false);
    });

    it("should validate reviewAbsenceSchema requires APPROVED or REJECTED", () => {
      const approved = reviewAbsenceSchema.safeParse({
        status: "APPROVED",
        reviewNote: "Đồng ý cho nghỉ",
      });
      assert.equal(approved.success, true);

      const invalid = reviewAbsenceSchema.safeParse({
        status: "MAYBE",
      });
      assert.equal(invalid.success, false);
    });
  });

  // ─── 8. General Absence Request (Intern Leave) ────────────────────────────

  describe("8. General Absence Request (TTS xin nghỉ dài ngày)", () => {
    it("should validate createAbsenceSchema requires startDate <= endDate", () => {
      const valid = createAbsenceSchema.safeParse({
        startDate: "2026-09-20",
        endDate: "2026-09-22",
        reason: "Nghỉ phép việc gia đình",
        evidenceUrl: "https://example.com/evidence.pdf",
      });
      assert.equal(valid.success, true);

      const invalidDates = createAbsenceSchema.safeParse({
        startDate: "2026-09-25",
        endDate: "2026-09-20",
        reason: "Sai ngày",
      });
      assert.equal(invalidDates.success, false);
    });

    it("should validate reviewGeneralAbsenceSchema", () => {
      const valid = reviewGeneralAbsenceSchema.safeParse({
        status: "APPROVED",
        reviewNote: "Duyệt nghỉ phép 3 ngày",
      });
      assert.equal(valid.success, true);

      const rejected = reviewGeneralAbsenceSchema.safeParse({
        status: "REJECTED",
        reviewNote: "Không đủ chứng từ",
      });
      assert.equal(rejected.success, true);

      const invalid = reviewGeneralAbsenceSchema.safeParse({
        status: "PENDING",
      });
      assert.equal(invalid.success, false);
    });

    it("AbsenceService should reject create when startDate > endDate", async () => {
      const absenceService = new AbsenceService();
      await assert.rejects(
        async () => {
          await absenceService.create(
            {
              startDate: new Date("2026-09-25"),
              endDate: new Date("2026-09-20"),
              reason: "Lỗi ngày",
            },
            { id: "intern-1", role: "INTERN" },
          );
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_DATE_RANGE);
          return true;
        },
      );
    });
  });
});
