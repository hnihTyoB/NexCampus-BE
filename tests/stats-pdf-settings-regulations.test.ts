import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";

// Modules under test
import {
  adminStatsQuerySchema,
  leaderStatsQuerySchema,
  internStatsQuerySchema,
} from "../src/modules/stats/stats.validation";
import {
  WeeklyEvaluationPdfDTO,
  InternshipSummaryPdfDTO,
} from "../src/modules/pdf-export/pdf-export.dto";
import {
  exportWeeklyEvaluationParamSchema,
  exportInternshipSummaryParamSchema,
} from "../src/modules/pdf-export/pdf-export.validation";
import pdfExportRouter from "../src/modules/pdf-export/pdf-export.route";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  settingKeyParamSchema,
  updateSystemSettingSchema,
  batchUpdateSystemSettingsSchema,
} from "../src/modules/system-settings/system-setting.validation";
import { SystemSettingService } from "../src/modules/system-settings/system-setting.service";
import {
  createRegulationSchema,
  updateRegulationSchema,
  regulationQuerySchema,
  regulationIdParamSchema,
} from "../src/modules/regulations/regulation.validation";

describe("1. Module Thống kê Dashboard (Stats)", () => {
  it("validate đúng query parameters cho admin, leader, intern", () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";

    const adminQuery = adminStatsQuerySchema.safeParse({ departmentId: validUuid });
    assert.equal(adminQuery.success, true);

    const leaderQuery = leaderStatsQuerySchema.safeParse({});
    assert.equal(leaderQuery.success, true);

    const internQuery = internStatsQuerySchema.safeParse({ internId: validUuid });
    assert.equal(internQuery.success, true);

    const invalidUuidQuery = internStatsQuerySchema.safeParse({ internId: "not-a-uuid" });
    assert.equal(invalidUuidQuery.success, false);
  });

  it("tính toán retention rate và completion rate chính xác", () => {
    const totalInterns = 20;
    const activeInterns = 18;
    const retentionRate = totalInterns > 0 ? Math.round((activeInterns / totalInterns) * 100) : 0;
    assert.equal(retentionRate, 90);

    const totalTasks = 45;
    const completedTasks = 36;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    assert.equal(completionRate, 80);
  });

  it("xác định riskLevel cho Leader team dựa trên số lượng task quá hạn", () => {
    const calculateRisk = (overdueCount: number) => {
      return overdueCount >= 3 ? "DANGER" : overdueCount >= 1 ? "WARNING" : "HEALTHY";
    };

    assert.equal(calculateRisk(0), "HEALTHY");
    assert.equal(calculateRisk(1), "WARNING");
    assert.equal(calculateRisk(2), "WARNING");
    assert.equal(calculateRisk(3), "DANGER");
    assert.equal(calculateRisk(5), "DANGER");
  });
});

describe("2. Module Xuất Báo Cáo PDF (pdf-export)", () => {
  it("validate tham số xuất PDF hợp lệ", () => {
    const validId = "22222222-2222-4222-8222-222222222222";

    const evalParam = exportWeeklyEvaluationParamSchema.safeParse({ id: validId });
    assert.equal(evalParam.success, true);

    const summaryParam = exportInternshipSummaryParamSchema.safeParse({ internId: validId });
    assert.equal(summaryParam.success, true);

    const invalidParam = exportWeeklyEvaluationParamSchema.safeParse({ id: "invalid" });
    assert.equal(invalidParam.success, false);
  });

  it("khởi tạo WeeklyEvaluationPdfDTO với đầy đủ 12 tiêu chí chuẩn và QR code", () => {
    const mockRawEval = {
      id: "eval-101",
      week: 3,
      score: 8.8,
      comment: "Thực tập sinh thể hiện rất tốt kỹ năng giải quyết vấn đề.",
      ratings: {
        ruleCompliance: "TOT",
        workAttitude: "TOT",
        learningCapacity: "KHA",
        resilience: "KHA",
        communication: "TOT",
        knowledge: "KHA",
        practicalSkills: "TOT",
        foreignLanguage: "TB",
        teamwork: "TOT",
        creativity: "KHA",
        contentQuality: "TOT",
        progressDelivery: "TOT",
      },
      aiRatings: {
        ruleCompliance: "TOT",
        workAttitude: "TOT",
        learningCapacity: "TOT",
        practicalSkills: "KHA",
      },
      aiComment: "Điểm mạnh:\n• Nắm bắt nhanh logic\nCần cải thiện:\n• Cần chú ý comment code",
      intern: {
        id: "intern-01",
        fullName: "Nguyễn Văn A",
        internCode: "INT-2026-001",
        startDate: new Date("2026-07-01"),
        department: { name: "Backend Core" },
        position: { name: "NodeJS Developer" },
      },
      leader: { fullName: "Trần Trưởng Nhóm" },
      createdAt: new Date(),
    };

    const mockPrevWeek = {
      id: "eval-100",
      week: 2,
      score: 8.2,
      comment: "Tuần trước làm khá tốt.",
    };

    const mockStats = {
      taskTotal: 6,
      taskCompleted: 5,
      taskItems: [
        { title: "Task 1", code: "BE-01", status: "DONE", isDone: true, submissionCount: 1 },
        { title: "Task 2", code: "BE-02", status: "DONE", isDone: true, submissionCount: 2 },
      ],
      dailyReportTotal: 5,
      submissionTotal: 7,
      rejectedTotal: 1,
    };

    const dto = new WeeklyEvaluationPdfDTO(mockRawEval, mockPrevWeek, mockStats);

    assert.equal(dto.internName, "Nguyễn Văn A");
    assert.equal(dto.week, 3);
    assert.equal(dto.hasRatings, true);
    assert.equal(dto.criteriaSections.length, 3);
    assert.equal(dto.criteriaSections[0].criteria.length, 5); // Nhóm 1: 5 tiêu chí
    assert.equal(dto.criteriaSections[1].criteria.length, 5); // Nhóm 2: 5 tiêu chí
    assert.equal(dto.criteriaSections[2].criteria.length, 2); // Nhóm 3: 2 tiêu chí
    assert.ok(decodeURIComponent(dto.qrCodeUrl).includes("evaluations/verify/eval-101"));
    assert.equal(dto.performance.taskCompletionRate, 83); // 5/6 = 83%
    assert.equal(dto.hasPreviousWeek, true);
    assert.ok(dto.progressSummary.includes("tăng 0.6 điểm"));
  });

  it("khởi tạo InternshipSummaryPdfDTO với xếp loại và điểm trung bình", () => {
    const mockIntern = {
      id: "intern-final-01",
      fullName: "Lê Văn C",
      internCode: "INT-FINAL-01",
      university: "Đại học Bách Khoa",
      major: "Khoa học Máy tính",
      department: { name: "Phát triển Phần mềm" },
      position: { name: "Backend Engineer" },
      startDate: new Date("2026-06-01"),
      duration: 3,
      status: "COMPLETED",
      leader: { fullName: "Phạm Leader" },
    };

    const mockEvaluations = [
      { week: 1, score: 8.0, grade: "KHA", comment: "Bắt đầu tốt" },
      { week: 2, score: 8.5, grade: "KHA", comment: "Tiến bộ" },
      { week: 3, score: 9.0, grade: "TOT", comment: "Xuất sắc" },
      { week: 4, score: 9.5, grade: "TOT", comment: "Rất xuất sắc" },
    ];

    const mockTaskStats = { total: 12, completed: 12 };
    const mockReportCount = 20;

    const dto = new InternshipSummaryPdfDTO(mockIntern, mockEvaluations, mockTaskStats, mockReportCount);

    assert.equal(dto.internName, "Lê Văn C");
    assert.equal(dto.avgScore, 8.8); // (8+8.5+9+9.5)/4 = 8.75 -> 8.8
    assert.equal(dto.finalGrade, "Giỏi");
    assert.equal(dto.finalStatusLabel, "ĐÃ HOÀN THÀNH");
    assert.equal(dto.completionRate, 100);
    assert.ok(decodeURIComponent(dto.qrCodeUrl).includes("certificates/verify/intern-final-01"));
  });

  it("biên dịch và render thành công template Handlebars cho cả 2 loại PDF", () => {
    // 1. Template weekly evaluation
    const weeklyTplPath = path.join(process.cwd(), "templates", "pdf", "weekly-evaluation.hbs");
    assert.equal(fs.existsSync(weeklyTplPath), true, "weekly-evaluation.hbs must exist");
    const weeklyTplSource = fs.readFileSync(weeklyTplPath, "utf-8");
    const compiledWeekly = handlebars.compile(weeklyTplSource);
    assert.equal(typeof compiledWeekly, "function");

    // 2. Template internship summary
    const summaryTplPath = path.join(process.cwd(), "templates", "pdf", "internship-summary.hbs");
    assert.equal(fs.existsSync(summaryTplPath), true, "internship-summary.hbs must exist");
    const summaryTplSource = fs.readFileSync(summaryTplPath, "utf-8");
    const compiledSummary = handlebars.compile(summaryTplSource);
    assert.equal(typeof compiledSummary, "function");

    const htmlOutput = compiledSummary({
      internName: "Test Intern",
      internCode: "INT-TEST",
      university: "ĐH CNTT",
      major: "CNTT",
      departmentName: "Kỹ thuật",
      positionName: "TTS",
      startDateFormatted: "01/07/2026",
      endDateFormatted: "30/09/2026",
      leaderName: "Test Leader",
      finalStatusLabel: "ĐÃ HOÀN THÀNH",
      avgScore: 9.0,
      finalGrade: "Xuất sắc",
      finalGradeCode: "TOT",
      tasksCompleted: 10,
      tasksTotal: 10,
      completionRate: 100,
      reportsTotal: 15,
      weeklyEvaluations: [],
      finalAssessmentLeader: "Đạt yêu cầu tốt",
      finalRecommendation: "Được tuyển dụng",
      qrCodeUrl: "https://example.com/qr.png",
    });

    assert.ok(htmlOutput.includes("BẢNG TỔNG HỢP KẾT QUẢ THỰC TẬP"));
    assert.ok(htmlOutput.includes("Test Intern"));
  });

  it("định nghĩa quyền PERMISSIONS và gắn middleware phân quyền vào routes pdf-export", () => {
    assert.equal(PERMISSIONS.PDF_EXPORT_SUMMARY, "PDF_EXPORT_SUMMARY");
    assert.equal(PERMISSIONS.PDF_EXPORT_WEEKLY_EVALUATION, "PDF_EXPORT_WEEKLY_EVALUATION");

    const routes = (pdfExportRouter as any).stack.filter((layer: any) => layer.route);
    assert.equal(routes.length, 2);

    const weeklyLayer = routes.find((r: any) => r.route.path === "/weekly-evaluation/:id");
    assert.ok(weeklyLayer, "Route /weekly-evaluation/:id phải tồn tại");
    // Weekly evaluation route must have at least auth, requirePermission, validate, controller (4 handlers)
    assert.ok(weeklyLayer.route.stack.length >= 4);

    const summaryLayer = routes.find((r: any) => r.route.path === "/internship-summary/:internId");
    assert.ok(summaryLayer, "Route /internship-summary/:internId phải tồn tại");
    // Summary route must have at least auth, requirePermission, validate, controller (4 handlers)
    assert.ok(summaryLayer.route.stack.length >= 4);
  });
});

describe("3. Module Cài Đặt Hệ Thống (System Settings)", () => {
  it("validate các cài đặt hệ thống hợp lệ và không hợp lệ", () => {
    const validKey = settingKeyParamSchema.safeParse({ key: "DAILY_REPORT_DEADLINE_TIME" });
    assert.equal(validKey.success, true);

    const validUpdate = updateSystemSettingSchema.safeParse({ value: "18:00" });
    assert.equal(validUpdate.success, true);

    const validNumberUpdate = updateSystemSettingSchema.safeParse({ value: 10 });
    assert.equal(validNumberUpdate.success, true);

    const validBatch = batchUpdateSystemSettingsSchema.safeParse({
      settings: {
        MAX_ACTIVE_TASKS: 6,
        MAX_WORKLOAD_DAYS: 15,
        AUTO_EVALUATION_ENABLED: true,
      },
    });
    assert.equal(validBatch.success, true);
  });

  it("kiểm tra validation nghiệp vụ trong SystemSettingService", async () => {
    const service = new SystemSettingService();

    // Giờ chốt nộp báo cáo sai format
    await assert.rejects(
      async () => {
        await service.updateSetting("DAILY_REPORT_DEADLINE_TIME", "25:99");
      },
      { message: /Giờ chốt nộp báo cáo phải có định dạng HH:mm/ }
    );

    // Submission size quá lớn
    await assert.rejects(
      async () => {
        await service.updateSetting("SUBMISSION_MAX_FILE_SIZE_MB", 200);
      },
      { message: /Dung lượng bài nộp tối đa phải nằm trong khoảng/ }
    );

    // Max active tasks không hợp lệ
    await assert.rejects(
      async () => {
        await service.updateSetting("MAX_ACTIVE_TASKS", 0);
      },
      { message: /Số task active tối đa của 1 TTS phải từ 1 đến 50/ }
    );
  });
});

describe("4. Module Quản Lý Nội Quy (Regulations)", () => {
  it("validate schema cho tạo và cập nhật nội quy", () => {
    const validCreate = createRegulationSchema.safeParse({
      title: "Nội quy thực tập năm 2026",
      content: "Nội quy chi tiết về thời gian làm việc, bảo mật dữ liệu và trang phục.",
      isActive: true,
    });
    assert.equal(validCreate.success, true);

    const shortTitle = createRegulationSchema.safeParse({
      title: "A",
      content: "Nội dung hợp lệ dài trên mười ký tự.",
    });
    assert.equal(shortTitle.success, false);

    const shortContent = createRegulationSchema.safeParse({
      title: "Tiêu đề hợp lệ",
      content: "Ngắn",
    });
    assert.equal(shortContent.success, false);

    const validQuery = regulationQuerySchema.safeParse({
      page: "2",
      limit: "15",
      isActive: "true",
    });
    assert.equal(validQuery.success, true);
    if (validQuery.success) {
      assert.equal(validQuery.data.page, 2);
      assert.equal(validQuery.data.limit, 15);
      assert.equal(validQuery.data.isActive, true);
    }
  });

  it("validate tham số acknowledge nội quy hợp lệ", () => {
    const validId = "33333333-3333-4333-8333-333333333333";
    const parsed = regulationIdParamSchema.safeParse({ id: validId });
    assert.equal(parsed.success, true);
  });
});
