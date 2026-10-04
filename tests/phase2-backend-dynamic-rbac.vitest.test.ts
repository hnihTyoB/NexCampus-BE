import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../src/config/jwt.config";
import { requirePermission } from "../src/middlewares/permission.middleware";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { AppError } from "../src/common/errors/app-error";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { DailyReportService } from "../src/modules/daily-reports/daily-report.service";
import { TaskAssignmentService } from "../src/modules/task-assignments/task-assignment.service";
import { WeeklyEvaluationService } from "../src/modules/weekly-evaluations/weekly-evaluation.service";
import { DepartmentService } from "../src/modules/departments/department.service";
import { prisma } from "../src/database/prisma.client";

describe("Phase 2: Backend Dynamic RBAC & Service Refactor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionCacheService.clear();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. Auth & JWT: portalType in Token Payloads
  // ═════════════════════════════════════════════════════════════════════════════
  describe("Auth & JWT Token Payloads", () => {
    it("should issue access token containing portalType (ADMIN)", () => {
      const payload = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@nexcampus.edu.vn",
        role: "SYSTEM_ADMIN",
        roleId: "00000000-0000-0000-0000-000000000002",
        portalType: "ADMIN",
        purpose: "ACCESS",
      };

      const token = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: "1h" });
      const decoded = jwt.verify(token, jwtConfig.accessSecret) as any;

      expect(decoded.id).toBe("00000000-0000-0000-0000-000000000001");
      expect(decoded.portalType).toBe("ADMIN");
      expect(decoded.role).toBe("SYSTEM_ADMIN");
      expect(decoded.purpose).toBe("ACCESS");
    });

    it("should issue access token containing portalType (LEADER)", () => {
      const payload = {
        id: "00000000-0000-0000-0000-000000000003",
        email: "leader@nexcampus.edu.vn",
        role: "TEAM_LEAD",
        roleId: "00000000-0000-0000-0000-000000000004",
        portalType: "LEADER",
        purpose: "ACCESS",
      };

      const token = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: "1h" });
      const decoded = jwt.verify(token, jwtConfig.accessSecret) as any;

      expect(decoded.portalType).toBe("LEADER");
      expect(decoded.role).toBe("TEAM_LEAD");
    });

    it("should issue access token containing portalType (INTERN)", () => {
      const payload = {
        id: "00000000-0000-0000-0000-000000000005",
        email: "intern@nexcampus.edu.vn",
        role: "FRONTEND_INTERN",
        roleId: "00000000-0000-0000-0000-000000000006",
        portalType: "INTERN",
        purpose: "ACCESS",
      };

      const token = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: "1h" });
      const decoded = jwt.verify(token, jwtConfig.accessSecret) as any;

      expect(decoded.portalType).toBe("INTERN");
      expect(decoded.role).toBe("FRONTEND_INTERN");
    });

    it("should issue refresh token containing portalType and jti", () => {
      const payload = {
        id: "00000000-0000-0000-0000-000000000007",
        email: "coord@nexcampus.edu.vn",
        role: "COORDINATOR",
        roleId: "00000000-0000-0000-0000-000000000008",
        portalType: "LEADER",
        purpose: "ACCESS",
        jti: "token-uuid-1234",
      };

      const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: "7d" });
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as any;

      expect(decoded.id).toBe("00000000-0000-0000-0000-000000000007");
      expect(decoded.portalType).toBe("LEADER");
      expect(decoded.jti).toBe("token-uuid-1234");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. Dynamic RBAC Guard (Permission-based, table-independent)
  // ═════════════════════════════════════════════════════════════════════════════
  describe("Dynamic RBAC Guard", () => {
    it("should authorize access for a custom arbitrary role possessing the required permission", async () => {
      const customRoleId = "00000000-0000-0000-0000-000000000009";
      const customUserId = "00000000-0000-0000-0000-000000000010";

      (permissionCacheService as any).cache.set(customRoleId, {
        permissions: new Set([PERMISSIONS.DAILY_REPORT_READ, PERMISSIONS.DAILY_REPORT_CREATE]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(customUserId, {
        user: {
          id: customUserId,
          isActive: true,
          deletedAt: null,
          roleId: customRoleId,
          roleName: "ComplianceAuditor",
          portalType: "ADMIN",
        },
        expiresAt: Date.now() + 60000,
      });

      const middleware = requirePermission(PERMISSIONS.DAILY_REPORT_READ);
      const req = {
        user: {
          id: customUserId,
          email: "auditor@nexcampus.edu.vn",
          role: "ComplianceAuditor",
          roleId: customRoleId,
          portalType: "ADMIN",
        },
      } as any;
      const res = {} as any;

      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        if (err) nextError = err;
        else nextCalled = true;
      });

      expect(nextError).toBeNull();
      expect(nextCalled).toBe(true);
      expect(req.user.permissions).toContain(PERMISSIONS.DAILY_REPORT_READ);
    });

    it("should forbid access when custom role lacks the required permission", async () => {
      const customRoleId = "00000000-0000-0000-0000-000000000011";
      const customUserId = "00000000-0000-0000-0000-000000000012";

      (permissionCacheService as any).cache.set(customRoleId, {
        permissions: new Set([PERMISSIONS.USER_READ]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(customUserId, {
        user: {
          id: customUserId,
          isActive: true,
          deletedAt: null,
          roleId: customRoleId,
          roleName: "GuestReviewer",
          portalType: "INTERN",
        },
        expiresAt: Date.now() + 60000,
      });

      const middleware = requirePermission(PERMISSIONS.DAILY_REPORT_FEEDBACK);
      const req = {
        user: {
          id: customUserId,
          role: "GuestReviewer",
          roleId: customRoleId,
          portalType: "INTERN",
        },
      } as any;
      const res = {} as any;

      let nextError: any = null;
      await middleware(req, res, (err) => {
        nextError = err;
      });

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(403);
      expect(nextError.code).toBe(ERROR_CODE.FORBIDDEN);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. DailyReportService: userId & Dynamic Permission Enforcement
  // ═════════════════════════════════════════════════════════════════════════════
  describe("DailyReportService Refactor", () => {
    it("should allow report submission when user has DAILY_REPORT_CREATE permission", async () => {
      const service = new DailyReportService();
      const targetUserId = "00000000-0000-0000-0000-000000000013";

      vi.spyOn(permissionCacheService, "getUserPermissions").mockResolvedValue([
        PERMISSIONS.DAILY_REPORT_CREATE,
      ]);

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: targetUserId,
        isActive: true,
        deletedAt: null,
      } as any);

      const mockReport = {
        id: "00000000-0000-0000-0000-000000000123",
        userId: targetUserId,
        internId: targetUserId,
        date: new Date(),
        title: "Báo cáo ngày 1",
        todayWork: "Làm tính năng auth",
        issues: null,
        tomorrowPlan: "Viết test",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn((service as any).repository, "findByUserAndDate").mockResolvedValue(null);
      vi.spyOn((service as any).repository, "upsert").mockResolvedValue(mockReport);
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      const result = await service.submitReport(
        {
          userId: targetUserId,
          title: "Báo cáo ngày 1",
          todayWork: "Làm tính năng auth",
          tomorrowPlan: "Viết test",
        },
        {
          id: targetUserId,
          email: "intern@nexcampus.edu.vn",
          role: "INTERN",
        },
      );

      expect(result.userId).toBe(targetUserId);
      expect(result.title).toBe("Báo cáo ngày 1");
    });

    it("should allow feedback if user is department manager or direct mentor", async () => {
      const service = new DailyReportService();
      const reviewerUserId = "00000000-0000-0000-0000-000000000014";
      const targetUserId = "00000000-0000-0000-0000-000000000015";
      const departmentId = "00000000-0000-0000-0000-000000000016";

      vi.spyOn(permissionCacheService, "getUserPermissions").mockResolvedValue([
        PERMISSIONS.DAILY_REPORT_FEEDBACK,
      ]);

      const mockExistingReport = {
        id: "00000000-0000-0000-0000-000000000456",
        userId: targetUserId,
        internId: targetUserId,
        feedback: null,
        feedbackAt: null,
        reviewerId: null,
        user: {
          internshipProfile: {
            departmentId,
            mentorId: "00000000-0000-0000-0000-000000000017",
          },
        },
      };

      vi.spyOn((service as any).repository, "findById").mockResolvedValue(mockExistingReport);
      vi.spyOn(prisma.internshipProfile, "findUnique").mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000018",
        userId: targetUserId,
        departmentId,
        mentorId: "00000000-0000-0000-0000-000000000017",
      } as any);

      vi.spyOn(prisma.departmentManager, "findUnique").mockResolvedValue({
        departmentId,
        userId: reviewerUserId,
        isPrimary: true,
        title: "Trưởng phòng Kỹ thuật",
        createdAt: new Date(),
      } as any);

      vi.spyOn((service as any).repository, "addFeedback").mockResolvedValue({
        ...mockExistingReport,
        feedback: "Làm tốt lắm, tiếp tục phát huy!",
        feedbackAt: new Date(),
        reviewerId: reviewerUserId,
      });
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      const updated = await service.addFeedback(
        "00000000-0000-0000-0000-000000000456",
        { feedback: "Làm tốt lắm, tiếp tục phát huy!" },
        reviewerUserId,
      );

      expect(updated.feedback).toBe("Làm tốt lắm, tiếp tục phát huy!");
      expect(updated.reviewerId).toBe(reviewerUserId);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. TaskAssignmentService: assigneeId pointing directly to User
  // ═════════════════════════════════════════════════════════════════════════════
  describe("TaskAssignmentService Refactor", () => {
    it("should enforce task capacity directly against User.id (assigneeId)", async () => {
      const service = new TaskAssignmentService();
      const assigneeUserId = "00000000-0000-0000-0000-000000000021";
      const taskId = "00000000-0000-0000-0000-000000000022";
      const assignerUserId = "00000000-0000-0000-0000-000000000024";

      vi.spyOn(permissionCacheService, "getUserPermissions").mockResolvedValue([
        PERMISSIONS.TASK_ASSIGNMENT_APPROVE,
        PERMISSIONS.TASK_ASSIGNMENT_CREATE,
      ]);

      vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
        if (args?.where?.id === assigneeUserId) {
          return { id: assigneeUserId, fullName: "Assignee User" } as any;
        }
        return null;
      });

      vi.spyOn(prisma.user, "findFirst").mockImplementation(async (args: any) => {
        if (args?.where?.id === assigneeUserId) {
          return {
            id: assigneeUserId,
            isActive: true,
            deletedAt: null,
            fullName: "Assignee User",
            internshipProfile: null,
          } as any;
        }
        return null;
      });

      vi.spyOn(prisma.task, "findUnique").mockResolvedValue({
        id: taskId,
        title: "Setup Cloud Infrastructure",
        estDays: 2,
        deadline: new Date(Date.now() + 86400000 * 7),
        deletedAt: null,
        taskGroupId: null,
        taskGroup: null,
      } as any);

      // Mock task with taskGroup limits
      vi.spyOn(prisma.task, "findFirst").mockResolvedValue({
        id: taskId,
        taskGroup: { maxWorkloadDays: 14, maxActiveTasks: 2 },
      } as any);

      // Active assignments already at maxActiveTasks (2 active tasks)
      vi.spyOn(prisma.taskAssignment, "findMany").mockResolvedValue([
        { assigneeId: assigneeUserId, supportId: null, task: { estDays: 2 } },
        { assigneeId: assigneeUserId, supportId: null, task: { estDays: 3 } },
      ] as any);

      vi.spyOn((service as any).repository, "findByTaskId").mockResolvedValue(null);

      await expect(
        service.create(
          {
            taskId,
            assigneeId: assigneeUserId,
          },
          assignerUserId,
        ),
      ).rejects.toThrow("Số lượng nhiệm vụ đang xử lý vượt quá giới hạn");
    });

    it("should successfully assign task pointing assigneeId and supportId to User", async () => {
      const service = new TaskAssignmentService();
      const assigneeUserId = "00000000-0000-0000-0000-000000000025";
      const supportUserId = "00000000-0000-0000-0000-000000000026";
      const taskId = "00000000-0000-0000-0000-000000000027";
      const assignerUserId = "00000000-0000-0000-0000-000000000028";

      vi.spyOn(permissionCacheService, "getUserPermissions").mockResolvedValue([
        PERMISSIONS.TASK_ASSIGNMENT_APPROVE,
        PERMISSIONS.TASK_ASSIGNMENT_CREATE,
      ]);

      vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
        if (args?.where?.id === assigneeUserId) {
          return { id: assigneeUserId, fullName: "Assignee User" } as any;
        }
        if (args?.where?.id === supportUserId) {
          return { id: supportUserId, fullName: "Support User" } as any;
        }
        return null;
      });

      vi.spyOn(prisma.user, "findFirst").mockImplementation(async (args: any) => {
        if (args?.where?.id === assigneeUserId) {
          return {
            id: assigneeUserId,
            isActive: true,
            deletedAt: null,
            fullName: "Assignee Name",
            internshipProfile: null,
          } as any;
        }
        if (args?.where?.id === supportUserId) {
          return {
            id: supportUserId,
            isActive: true,
            deletedAt: null,
            fullName: "Support Name",
          } as any;
        }
        return null;
      });

      vi.spyOn(prisma.task, "findUnique").mockResolvedValue({
        id: taskId,
        title: "Setup API Gateway",
        estDays: 2,
        deadline: new Date(Date.now() + 86400000 * 7),
        deletedAt: null,
        taskGroupId: null,
        taskGroup: null,
      } as any);

      vi.spyOn(prisma.task, "findFirst").mockResolvedValue({
        id: taskId,
        taskGroup: { maxWorkloadDays: 14, maxActiveTasks: 5 },
      } as any);

      vi.spyOn(prisma.taskAssignment, "findMany").mockResolvedValue([]);

      const mockCreatedAssignment = {
        id: "00000000-0000-0000-0000-000000000202",
        taskId,
        assigneeId: assigneeUserId,
        supportId: supportUserId,
        internId: assigneeUserId,
        assignedBy: assignerUserId,
        status: "TODO",
        assignedAt: new Date(),
        updatedAt: new Date(),
        assignee: { id: assigneeUserId, fullName: "Assignee Name" },
        support: { id: supportUserId, fullName: "Support Name" },
      };

      vi.spyOn((service as any).repository, "findByTaskId").mockResolvedValue(null);
      vi.spyOn((service as any).repository, "create").mockResolvedValue(mockCreatedAssignment);
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      const result = await service.create(
        {
          taskId,
          assigneeId: assigneeUserId,
          supportId: supportUserId,
        },
        assignerUserId,
      );

      expect(result.assigneeId).toBe(assigneeUserId);
      expect(result.supportId).toBe(supportUserId);
      expect(result.status).toBe("TODO");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. WeeklyEvaluationService: targetUserId & evaluatorId on User
  // ═════════════════════════════════════════════════════════════════════════════
  describe("WeeklyEvaluationService Refactor", () => {
    it("should authorize reviewer via DepartmentManager relationship", async () => {
      const service = new WeeklyEvaluationService();
      const evaluatorUserId = "00000000-0000-0000-0000-000000000031";
      const targetUserId = "00000000-0000-0000-0000-000000000032";
      const departmentId = "00000000-0000-0000-0000-000000000033";

      vi.spyOn(permissionCacheService, "getUserPermissions").mockResolvedValue([
        PERMISSIONS.EVALUATION_CREATE,
      ]);

      vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
        if (args?.where?.id === targetUserId) {
          return {
            id: targetUserId,
            fullName: "Thực tập sinh QA",
          } as any;
        }
        return null;
      });

      vi.spyOn(prisma.user, "findFirst").mockImplementation(async (args: any) => {
        if (args?.where?.id === targetUserId) {
          return {
            id: targetUserId,
            fullName: "Thực tập sinh QA",
            createdAt: new Date(Date.now() - 3 * 86400000),
            internshipProfile: {
              departmentId,
              mentorId: "00000000-0000-0000-0000-000000000035",
              startDate: new Date(Date.now() - 3 * 86400000),
            },
          } as any;
        }
        return null;
      });

      vi.spyOn(prisma.internshipProfile, "findUnique").mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000034",
        userId: targetUserId,
        departmentId,
        mentorId: "00000000-0000-0000-0000-000000000035",
        startDate: new Date(Date.now() - 3 * 86400000),
      } as any);

      vi.spyOn(prisma.departmentManager, "findUnique").mockResolvedValue({
        departmentId,
        userId: evaluatorUserId,
        isPrimary: true,
        title: "QA Lead",
        createdAt: new Date(),
      } as any);

      vi.spyOn((service as any).repository, "findByTargetUserAndWeek").mockResolvedValue(null);

      const mockEvaluation = {
        id: "00000000-0000-0000-0000-000000000301",
        targetUserId,
        evaluatorId: evaluatorUserId,
        internId: targetUserId,
        leaderId: evaluatorUserId,
        week: 1,
        year: 2026,
        score: 8.5,
        grade: "TOT",
        ratings: {
          ruleCompliance: "TOT",
          workAttitude: "TOT",
          learningCapacity: "KHA",
          pressureTolerance: "KHA",
          workQuality: "TOT",
          workProgress: "TOT",
          teamwork: "TOT",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn((service as any).repository, "create").mockResolvedValue(mockEvaluation as any);
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      const result = await service.create(
        {
          targetUserId,
          week: 1,
          ratings: mockEvaluation.ratings as any,
          comment: "Hoàn thành tốt tuần đầu",
        },
        { id: evaluatorUserId, role: "TEAM_LEAD" },
      );

      expect(result.targetUserId).toBe(targetUserId);
      expect(result.evaluatorId).toBe(evaluatorUserId);
      expect(result.grade).toBe("TOT");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. DepartmentService & DepartmentManager Management
  // ═════════════════════════════════════════════════════════════════════════════
  describe("DepartmentService & DepartmentManager", () => {
    it("should assign a manager to department and manage primary manager switch", async () => {
      const service = new DepartmentService();
      const departmentId = "00000000-0000-0000-0000-000000000041";
      const managerUserId = "00000000-0000-0000-0000-000000000042";

      vi.spyOn((service as any), "findById").mockResolvedValue({
        id: departmentId,
        name: "Mobile App Division",
      });

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: managerUserId,
        fullName: "Trần Trưởng Phòng",
      } as any);

      const mockManagerResult = {
        departmentId,
        userId: managerUserId,
        title: "Technical Manager",
        isPrimary: true,
        createdAt: new Date(),
        user: {
          id: managerUserId,
          fullName: "Trần Trưởng Phòng",
          email: "tran.manager@nexcampus.edu.vn",
          avatarUrl: null,
        },
      };

      vi.spyOn((service as any).repository, "assignManager").mockResolvedValue(mockManagerResult);
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      const assigned = await service.assignManager(
        departmentId,
        {
          userId: managerUserId,
          title: "Technical Manager",
          isPrimary: true,
        },
        "00000000-0000-0000-0000-000000000043",
      );

      expect(assigned.departmentId).toBe(departmentId);
      expect(assigned.userId).toBe(managerUserId);
      expect(assigned.isPrimary).toBe(true);
      expect(assigned.title).toBe("Technical Manager");
    });

    it("should remove manager from department successfully", async () => {
      const service = new DepartmentService();
      const departmentId = "00000000-0000-0000-0000-000000000044";
      const managerUserId = "00000000-0000-0000-0000-000000000045";

      vi.spyOn((service as any), "findById").mockResolvedValue({
        id: departmentId,
        name: "Mobile App Division",
      });

      vi.spyOn((service as any).repository, "findManager").mockResolvedValue({
        departmentId,
        userId: managerUserId,
        isPrimary: false,
        title: "Mentor",
        user: { id: managerUserId, fullName: "Trần Trưởng Phòng", email: "test@domain", avatarUrl: null },
      });

      vi.spyOn((service as any).repository, "removeManager").mockResolvedValue(undefined);
      vi.spyOn((service as any).repository, "createAuditLog").mockResolvedValue({} as any);

      await expect(
        service.removeManager(departmentId, managerUserId, "00000000-0000-0000-0000-000000000046"),
      ).resolves.not.toThrow();
    });
  });
});
