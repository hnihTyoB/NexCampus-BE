import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  feedbackDailyReportSchema,
  calendarDailyReportSchema,
  queryDailyReportSchema,
  uploadReportUrlSchema,
} from "../src/modules/daily-reports/daily-report.validation";
import {
  createWeeklyEvaluationSchema,
  updateWeeklyEvaluationSchema,
  aiSuggestSchema,
  queryWeeklyEvaluationSchema,
  ratingsSchema,
} from "../src/modules/weekly-evaluations/weekly-evaluation.validation";
import {
  computeAverageScore,
  computeGrade,
  getWeekDateRange,
  ratingToScore,
  WeeklyEvaluationAiService,
} from "../src/modules/weekly-evaluations/weekly-evaluation.ai.service";
import { DailyReportService } from "../src/modules/daily-reports/daily-report.service";
import { WeeklyEvaluationService } from "../src/modules/weekly-evaluations/weekly-evaluation.service";
import { EvaluationGrade } from "@prisma/client";
import { swaggerSpec } from "../src/config/swagger.config";
import { getVietnamToday, toCalendarDate } from "../src/common/helpers/date.helper";
import { systemSettingService } from "../src/modules/system-settings/system-setting.service";

describe("Daily Reports & Weekly Evaluations Test Suite", () => {
  // ─── 1. Constants, Permissions & Error Codes ──────────────────────────────

  describe("1. Error Codes, Audit Actions & Permissions", () => {
    it("should export daily reports and weekly evaluation error codes correctly", () => {
      assert.equal(ERROR_CODE.REPORT_NOT_FOUND, "REPORT_NOT_FOUND");
      assert.equal(ERROR_CODE.REPORT_ALREADY_EXISTS, "REPORT_ALREADY_EXISTS");
      assert.equal(ERROR_CODE.EVALUATION_NOT_FOUND, "EVALUATION_NOT_FOUND");
      assert.equal(ERROR_CODE.EVALUATION_ALREADY_EXISTS, "EVALUATION_ALREADY_EXISTS");
      assert.equal(ERROR_CODE.NOT_EVALUATION_INTERN, "NOT_EVALUATION_INTERN");
      assert.equal(ERROR_CODE.EVALUATION_WINDOW_CLOSED, "EVALUATION_WINDOW_CLOSED");
      assert.equal(ERROR_CODE.EVALUATION_INVALID_WEEK, "EVALUATION_INVALID_WEEK");
    });

    it("should export daily reports and weekly evaluation permissions correctly", () => {
      assert.equal(PERMISSIONS.DAILY_REPORT_READ, "DAILY_REPORT_READ");
      assert.equal(PERMISSIONS.DAILY_REPORT_CREATE, "DAILY_REPORT_CREATE");
      assert.equal(PERMISSIONS.DAILY_REPORT_UPDATE, "DAILY_REPORT_UPDATE");
      assert.equal(PERMISSIONS.DAILY_REPORT_DELETE, "DAILY_REPORT_DELETE");
      assert.equal(PERMISSIONS.DAILY_REPORT_FEEDBACK, "DAILY_REPORT_FEEDBACK");

      assert.equal(PERMISSIONS.WEEKLY_EVALUATION_READ, "WEEKLY_EVALUATION_READ");
      assert.equal(PERMISSIONS.WEEKLY_EVALUATION_CREATE, "WEEKLY_EVALUATION_CREATE");
      assert.equal(PERMISSIONS.WEEKLY_EVALUATION_UPDATE, "WEEKLY_EVALUATION_UPDATE");
      assert.equal(PERMISSIONS.WEEKLY_EVALUATION_DELETE, "WEEKLY_EVALUATION_DELETE");
      assert.equal(PERMISSIONS.WEEKLY_EVALUATION_CONFIRM, "WEEKLY_EVALUATION_CONFIRM");
    });

    it("should export audit actions and target types correctly", () => {
      assert.equal(AUDIT_ACTION.CREATE_DAILY_REPORT, "CREATE_DAILY_REPORT");
      assert.equal(AUDIT_ACTION.UPDATE_DAILY_REPORT, "UPDATE_DAILY_REPORT");
      assert.equal(AUDIT_ACTION.FEEDBACK_DAILY_REPORT, "FEEDBACK_DAILY_REPORT");
      assert.equal(AUDIT_ACTION.DELETE_DAILY_REPORT, "DELETE_DAILY_REPORT");
      assert.equal(AUDIT_ACTION.CREATE_WEEKLY_EVALUATION, "CREATE_WEEKLY_EVALUATION");
      assert.equal(AUDIT_ACTION.UPDATE_WEEKLY_EVALUATION, "UPDATE_WEEKLY_EVALUATION");
      assert.equal(AUDIT_ACTION.DELETE_WEEKLY_EVALUATION, "DELETE_WEEKLY_EVALUATION");
      assert.equal(AUDIT_ACTION.CONFIRM_WEEKLY_EVALUATION, "CONFIRM_WEEKLY_EVALUATION");

      assert.equal(AUDIT_TARGET_TYPE.DAILY_REPORT, "DAILY_REPORT");
      assert.equal(AUDIT_TARGET_TYPE.REPORT_ATTACHMENT, "REPORT_ATTACHMENT");
      assert.equal(AUDIT_TARGET_TYPE.WEEKLY_EVALUATION, "WEEKLY_EVALUATION");
    });
  });

  // ─── 2. Daily Report Validation Schemas ────────────────────────────────────

  describe("2. Daily Report Validation Schemas", () => {
    it("should accept valid createDailyReportSchema payload", () => {
      const valid = createDailyReportSchema.safeParse({
        content: "Hôm nay hoàn thành API daily-reports và viết tài liệu",
        blockers: "Gặp khó khăn khi đồng bộ timezone UTC+7 nhưng đã xử lý",
        nextPlan: "Triển khai weekly-evaluations vào ngày mai",
        hoursWorked: 8,
        prLink: "https://github.com/nexcampus/repo/pull/42",
        videoDemo: "https://youtu.be/demo123",
        attachments: [
          {
            fileName: "screenshot.png",
            fileUrl: "https://r2.nexcampus.com/reports/screenshot.png",
            filePath: "reports/screenshot.png",
            mimeType: "image/png",
            fileSize: 102400,
          },
        ],
      });

      assert.equal(valid.success, true);
    });

    it("should reject empty content in createDailyReportSchema", () => {
      const invalid = createDailyReportSchema.safeParse({
        content: "   ",
      });

      assert.equal(invalid.success, false);
    });

    it("should reject hoursWorked < 0 or > 24", () => {
      const negative = createDailyReportSchema.safeParse({
        content: "Công việc trong ngày",
        hoursWorked: -2,
      });
      assert.equal(negative.success, false);

      const excess = createDailyReportSchema.safeParse({
        content: "Công việc trong ngày",
        hoursWorked: 25,
      });
      assert.equal(excess.success, false);
    });

    it("should reject attachments exceeding 5 files", () => {
      const dummyAtt = {
        fileName: "file.png",
        fileUrl: "https://r2.nexcampus.com/reports/file.png",
        filePath: "reports/file.png",
        mimeType: "image/png",
        fileSize: 1024,
      };

      const result = createDailyReportSchema.safeParse({
        content: "Báo cáo nhiều file đính kèm",
        attachments: [dummyAtt, dummyAtt, dummyAtt, dummyAtt, dummyAtt, dummyAtt], // 6 files
      });

      assert.equal(result.success, false);
    });

    it("should validate calendar query schema with 1 <= month <= 12", () => {
      const valid = calendarDailyReportSchema.safeParse({
        month: "9",
        year: "2026",
      });
      assert.equal(valid.success, true);
      assert.equal(valid.data?.month, 9);
      assert.equal(valid.data?.year, 2026);

      const invalidMonth = calendarDailyReportSchema.safeParse({
        month: 13,
        year: 2026,
      });
      assert.equal(invalidMonth.success, false);
    });

    it("should validate feedback schema with min 1 and max 2000 characters", () => {
      const empty = feedbackDailyReportSchema.safeParse({ feedback: "" });
      assert.equal(empty.success, false);

      const valid = feedbackDailyReportSchema.safeParse({
        feedback: "Tiến độ rất tốt, cần lưu ý viết unit test cho các edge cases!",
      });
      assert.equal(valid.success, true);
    });

    it("should validate upload report url schema", () => {
      const valid = uploadReportUrlSchema.safeParse({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
      });
      assert.equal(valid.success, true);
    });
  });

  // ─── 3. Weekly Evaluation 12 Criteria & Scoring ───────────────────────────

  describe("3. Weekly Evaluation 12 Criteria & Scoring Logic", () => {
    it("should convert rating level to correct numerical score (10, 8, 6, 4, 2)", () => {
      assert.equal(ratingToScore("TOT"), 10);
      assert.equal(ratingToScore("KHA"), 8);
      assert.equal(ratingToScore("TB"), 6);
      assert.equal(ratingToScore("TBY"), 4);
      assert.equal(ratingToScore("YEU"), 2);
    });

    it("should compute average score accurately across all 12 criteria", () => {
      const ratingsAllTot = {
        ruleCompliance: "TOT" as const,
        workAttitude: "TOT" as const,
        learningCapacity: "TOT" as const,
        pressureTolerance: "TOT" as const,
        communication: "TOT" as const,
        knowledge: "TOT" as const,
        practicalSkill: "TOT" as const,
        languageProficiency: "TOT" as const,
        teamwork: "TOT" as const,
        creativity: "TOT" as const,
        contentRequirement: "TOT" as const,
        progressRequirement: "TOT" as const,
      };
      assert.equal(computeAverageScore(ratingsAllTot), 10.0);
      assert.equal(computeGrade(10.0), EvaluationGrade.TOT);

      // Mixed ratings: 6 TOT (10) and 6 KHA (8) -> avg = 9.0
      const ratingsMixed = {
        ...ratingsAllTot,
        knowledge: "KHA" as const,
        practicalSkill: "KHA" as const,
        languageProficiency: "KHA" as const,
        teamwork: "KHA" as const,
        creativity: "KHA" as const,
        contentRequirement: "KHA" as const,
      };
      assert.equal(computeAverageScore(ratingsMixed), 9.0);
      assert.equal(computeGrade(9.0), EvaluationGrade.TOT);

      // All TB (6) -> avg = 6.0
      const ratingsAllTb = {
        ruleCompliance: "TB" as const,
        workAttitude: "TB" as const,
        learningCapacity: "TB" as const,
        pressureTolerance: "TB" as const,
        communication: "TB" as const,
        knowledge: "TB" as const,
        practicalSkill: "TB" as const,
        languageProficiency: "TB" as const,
        teamwork: "TB" as const,
        creativity: "TB" as const,
        contentRequirement: "TB" as const,
        progressRequirement: "TB" as const,
      };
      assert.equal(computeAverageScore(ratingsAllTb), 6.0);
      assert.equal(computeGrade(6.0), EvaluationGrade.TB);
    });

    it("should map grade thresholds correctly", () => {
      assert.equal(computeGrade(8.0), EvaluationGrade.TOT);
      assert.equal(computeGrade(8.5), EvaluationGrade.TOT);
      assert.equal(computeGrade(7.9), EvaluationGrade.KHA);
      assert.equal(computeGrade(6.5), EvaluationGrade.KHA);
      assert.equal(computeGrade(6.4), EvaluationGrade.TB);
      assert.equal(computeGrade(5.0), EvaluationGrade.TB);
      assert.equal(computeGrade(4.9), EvaluationGrade.TBY);
      assert.equal(computeGrade(3.5), EvaluationGrade.TBY);
      assert.equal(computeGrade(3.4), EvaluationGrade.YEU);
      assert.equal(computeGrade(2.0), EvaluationGrade.YEU);
    });

    it("should validate all 12 criteria in ratingsSchema strictly", () => {
      const validRatings = {
        ruleCompliance: "TOT",
        workAttitude: "KHA",
        learningCapacity: "TOT",
        pressureTolerance: "TB",
        communication: "TOT",
        knowledge: "KHA",
        practicalSkill: "TOT",
        languageProficiency: "TB",
        teamwork: "TOT",
        creativity: "KHA",
        contentRequirement: "TOT",
        progressRequirement: "KHA",
      };
      const result = ratingsSchema.safeParse(validRatings);
      assert.equal(result.success, true);

      // Invalid criterion rating
      const invalid = ratingsSchema.safeParse({
        ...validRatings,
        ruleCompliance: "EXCELLENT", // Invalid enum value
      });
      assert.equal(invalid.success, false);

      // Missing criterion
      const missing = ratingsSchema.safeParse({
        ruleCompliance: "TOT",
      });
      assert.equal(missing.success, false);
    });

    it("should compute correct 7-day week date ranges from intern start date", () => {
      // Start date: 2026-08-01 (Saturday)
      const startDate = new Date("2026-08-01T00:00:00Z");

      const week1 = getWeekDateRange(startDate, 1);
      const week2 = getWeekDateRange(startDate, 2);

      const diffMsWeek1 = week1.to.getTime() - week1.from.getTime() + 1;
      assert.equal(diffMsWeek1, 7 * 24 * 3600 * 1000); // exactly 7 days

      assert.equal(week2.from.getTime(), week1.to.getTime() + 1);
    });
  });

  // ─── 4. Timezone & Date Helper Utilities ──────────────────────────────────

  describe("4. Timezone & Vietnam Calendar Date Helpers", () => {
    it("should compute getVietnamToday at midnight UTC representing local Vietnam calendar date", () => {
      const today = getVietnamToday();
      assert.equal(today.getUTCHours(), 0);
      assert.equal(today.getUTCMinutes(), 0);
      assert.equal(today.getUTCSeconds(), 0);
      assert.equal(today.getUTCMilliseconds(), 0);
    });

    it("should parse string YYYY-MM-DD correctly with toCalendarDate", () => {
      const d = toCalendarDate("2026-09-15");
      assert.equal(d.getUTCFullYear(), 2026);
      assert.equal(d.getUTCMonth(), 8); // 0-indexed: September is 8
      assert.equal(d.getUTCDate(), 15);
      assert.equal(d.getUTCHours(), 0);
    });
  });

  // ─── 5. AI Suggestion Fallback & Zero-Data Handling ────────────────────────

  describe("5. AI Suggestion Engine & Zero-Data Fallback", () => {
    it("should return all 12 criteria as TB with score 6.0 when zero data in week", async () => {
      const aiService = new WeeklyEvaluationAiService();

      // Access private method via any for unit testing heuristic evaluator
      const result = (aiService as any).evaluateHeuristic(
        "Nguyen Van A",
        1,
        {
          from: new Date("2026-09-01T00:00:00Z"),
          to: new Date("2026-09-07T23:59:59Z"),
        },
        [], // 0 daily reports
        [], // 0 submissions
      );

      assert.equal(result.score, 6.0);
      assert.equal(result.grade, EvaluationGrade.TB);
      assert.equal(result.ratings.ruleCompliance, "TB");
      assert.equal(result.ratings.practicalSkill, "TB");
      assert.equal(result.ratings.progressRequirement, "TB");
      assert.match(result.comment, /Thiếu dữ liệu hoạt động tuần 1/);
      assert.ok(result.recommendations.length >= 2);
    });

    it("should boost ratings when daily reports and approved tasks exist", () => {
      const aiService = new WeeklyEvaluationAiService();

      const mockReports = [
        { date: new Date(), hoursWorked: 8, content: "Làm task 1", prLink: "https://pr", videoDemo: null },
        { date: new Date(), hoursWorked: 8, content: "Làm task 2", prLink: "https://pr", videoDemo: null },
        { date: new Date(), hoursWorked: 8, content: "Làm task 3", prLink: "https://pr", videoDemo: null },
        { date: new Date(), hoursWorked: 8, content: "Làm task 4", prLink: "https://pr", videoDemo: null },
        { date: new Date(), hoursWorked: 8, content: "Làm task 5", prLink: "https://pr", videoDemo: null },
      ];

      const mockSubmissions = [
        {
          attempt: 1,
          reviewStatus: "APPROVED",
          assignment: { task: { title: "Xây dựng Daily Report API" } },
        },
      ];

      const result = (aiService as any).evaluateHeuristic(
        "Tran Thi B",
        2,
        {
          from: new Date("2026-09-08T00:00:00Z"),
          to: new Date("2026-09-14T23:59:59Z"),
        },
        mockReports,
        mockSubmissions,
      );

      assert.equal(result.ratings.ruleCompliance, "TOT");
      assert.equal(result.ratings.practicalSkill, "TOT");
      assert.equal(result.ratings.contentRequirement, "TOT");
      assert.ok(result.score >= 8.0);
      assert.equal(result.grade, EvaluationGrade.TOT);
      assert.ok(result.strengths.length > 0);
    });
  });

  // ─── 6. Service Unit & Scoping Logic ──────────────────────────────────────

  describe("6. Service Logic & Scoping", () => {
    it("DailyReportService getUploadUrl should generate R2 key with reports/ prefix", async () => {
      const service = new DailyReportService();
      (service as any).r2Service.getPresignedUploadUrl = async (key: string) => `https://mock-upload.r2.cloud/${key}`;
      (service as any).r2Service.getPublicUrl = (key: string) => `https://mock-public.r2.cloud/${key}`;

      const res = await service.getUploadUrl(
        { fileName: "my_report_doc.pdf", mimeType: "application/pdf" },
        { id: "user-123", email: "intern@nexcampus.com", role: "INTERN" },
      );

      assert.ok(res.filePath.startsWith("reports/"));
      assert.ok(res.filePath.includes("my_report_doc.pdf"));
      assert.ok(res.fileUrl.includes("reports/"));
      assert.ok(typeof res.uploadUrl === "string");
    });

    it("WeeklyEvaluationService detectLeaderEdited should return true if Leader changes any AI rating", () => {
      const service = new WeeklyEvaluationService();

      const baseRatings = {
        ruleCompliance: "TOT" as const,
        workAttitude: "TOT" as const,
        learningCapacity: "TOT" as const,
        pressureTolerance: "TOT" as const,
        communication: "TOT" as const,
        knowledge: "TOT" as const,
        practicalSkill: "TOT" as const,
        languageProficiency: "TOT" as const,
        teamwork: "TOT" as const,
        creativity: "TOT" as const,
        contentRequirement: "TOT" as const,
        progressRequirement: "TOT" as const,
      };

      // Exact match
      const notEdited = (service as any).detectLeaderEdited({
        ratings: baseRatings,
        aiRatings: baseRatings,
        comment: "Good job",
        aiComment: "Good job",
      });
      assert.equal(notEdited, false);

      // Leader modified a rating
      const editedRating = (service as any).detectLeaderEdited({
        ratings: { ...baseRatings, knowledge: "KHA" },
        aiRatings: baseRatings,
        comment: "Good job",
        aiComment: "Good job",
      });
      assert.equal(editedRating, true);

      // Leader modified comment
      const editedComment = (service as any).detectLeaderEdited({
        ratings: baseRatings,
        aiRatings: baseRatings,
        comment: "Leader personal note",
        aiComment: "AI generated comment",
      });
      assert.equal(editedComment, true);
    });

    it("should dynamically allow evaluation window according to WORKING_DAYS_PER_WEEK setting", async () => {
      const service = new WeeklyEvaluationService();
      const intern = {
        id: "mock-intern-1",
        startDate: new Date("2026-09-01T00:00:00Z"),
        createdAt: new Date("2026-09-01T00:00:00Z"),
      };

      const originalEnv = process.env.NODE_ENV;
      const originalGetWorkingDays = (systemSettingService as any).getWorkingDaysPerWeek;

      try {
        process.env.NODE_ENV = "production";
        // Mock permission check so it's a regular leader
        (service as any).hasGlobalEvaluationAccess = async () => false;
        (service as any).isAssignedMidWeekThisWeek = async () => false;

        // --- Test 1: WORKING_DAYS_PER_WEEK = 5 (Mon-Fri) ---
        (systemSettingService as any).getWorkingDaysPerWeek = async () => 5;

        // Friday 11:30 VN (UTC day = 5, hour = 11) -> Allowed
        const friday1130 = new Date(Date.UTC(2026, 8, 25, 11, 30));
        await (service as any).validateEvaluationWindow(
          "leader-1",
          intern,
          2,
          2,
          friday1130,
          friday1130,
        );

        // Friday 09:30 VN (UTC day = 5, hour = 9) -> Blocked (before 11:00)
        const friday0930 = new Date(Date.UTC(2026, 8, 25, 9, 30));
        await assert.rejects(
          async () => {
            await (service as any).validateEvaluationWindow(
              "leader-1",
              intern,
              2,
              2,
              friday0930,
              friday0930,
            );
          },
          (err: any) => {
            assert.equal(err.code, ERROR_CODE.EVALUATION_WINDOW_CLOSED);
            assert.ok(err.message.includes("Thứ Sáu"));
            return true;
          }
        );

        // Saturday (isoDay 6 > 5) -> Allowed
        const saturday = new Date(Date.UTC(2026, 8, 26, 9, 0));
        await (service as any).validateEvaluationWindow(
          "leader-1",
          intern,
          2,
          2,
          saturday,
          saturday,
        );

        // --- Test 2: WORKING_DAYS_PER_WEEK = 6 (Mon-Sat) ---
        (systemSettingService as any).getWorkingDaysPerWeek = async () => 6;

        // Friday 14:00 VN (isoDay 5 < 6) -> Blocked
        const friday1400 = new Date(Date.UTC(2026, 8, 25, 14, 0));
        await assert.rejects(
          async () => {
            await (service as any).validateEvaluationWindow(
              "leader-1",
              intern,
              2,
              2,
              friday1400,
              friday1400,
            );
          },
          (err: any) => {
            assert.equal(err.code, ERROR_CODE.EVALUATION_WINDOW_CLOSED);
            assert.ok(err.message.includes("Thứ Bảy"));
            return true;
          }
        );

        // Saturday 11:30 VN (isoDay 6, hour = 11) -> Allowed
        const saturday1130 = new Date(Date.UTC(2026, 8, 26, 11, 30));
        await (service as any).validateEvaluationWindow(
          "leader-1",
          intern,
          2,
          2,
          saturday1130,
          saturday1130,
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        (systemSettingService as any).getWorkingDaysPerWeek = originalGetWorkingDays;
      }
    });
  });

  // ─── 7. OpenAPI & Swagger Registration ────────────────────────────────────

  describe("7. OpenAPI / Swagger Specs Registration", () => {
    it("should register daily-reports paths in swagger spec", () => {
      const paths = Object.keys(swaggerSpec.paths);

      assert.ok(paths.includes("/daily-reports"));
      assert.ok(paths.includes("/daily-reports/upload-url"));
      assert.ok(paths.includes("/daily-reports/calendar"));
      assert.ok(paths.includes("/daily-reports/{id}"));
      assert.ok(paths.includes("/daily-reports/{id}/feedback"));
      assert.ok(paths.includes("/daily-reports/attachments/{attachmentId}"));
    });

    it("should register weekly-evaluations paths in swagger spec", () => {
      const paths = Object.keys(swaggerSpec.paths);

      assert.ok(paths.includes("/weekly-evaluations"));
      assert.ok(paths.includes("/weekly-evaluations/ai-suggest"));
      assert.ok(paths.includes("/weekly-evaluations/intern/{internId}/summary"));
      assert.ok(paths.includes("/weekly-evaluations/{id}"));
      assert.ok(paths.includes("/weekly-evaluations/{id}/confirm-view"));
    });
  });
});
