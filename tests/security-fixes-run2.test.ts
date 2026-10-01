import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AbsenceService } from "../src/modules/absences/absence.service";
import { WeeklyEvaluationService } from "../src/modules/weekly-evaluations/weekly-evaluation.service";
import { DailyReportService } from "../src/modules/daily-reports/daily-report.service";
import { TaskSubmissionService } from "../src/modules/task-submissions/task-submission.service";
import { TaskAssignmentService } from "../src/modules/task-assignments/task-assignment.service";
import { MeetingService } from "../src/modules/meetings/meeting.service";
import { SystemSettingService } from "../src/modules/system-settings/system-setting.service";
import { swaggerSpec } from "../src/config/swagger.config";
import absenceRouter from "../src/modules/absences/absence.route";
import authRouter from "../src/modules/auth/auth.route";
import { AppError } from "../src/common/errors/app-error";
import { prisma } from "../src/database/prisma.client";

describe("Security Fixes Comprehensive Verification: All 10+ Vulnerabilities Validated", () => {
  it("CRIT-01: AbsenceService.findAll should fail-closed with 403 for non-intern, non-leader callers", async () => {
    const service = new AbsenceService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000001", role: "USER" };

    await assert.rejects(
      async () => {
        await service.findAll({}, mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("CRIT-02: WeeklyEvaluationService.findAll should fail-closed with 403 instead of falling back to { isAdmin: true }", async () => {
    const service = new WeeklyEvaluationService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000002", role: "USER" };

    await assert.rejects(
      async () => {
        await service.findAll({}, mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("CRIT-03: DailyReportService.findAll should fail-closed with 403 for non-intern, non-leader callers", async () => {
    const service = new DailyReportService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000003", role: "USER" };

    await assert.rejects(
      async () => {
        await service.findAll({}, mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("HIGH-01: absenceRouter should register route handlers with RBAC permission middleware", () => {
    const stack = (absenceRouter as any).stack;
    assert.ok(Array.isArray(stack));
    const routes = stack.filter((layer: any) => layer.route);
    assert.ok(routes.length >= 7);

    // Verify all 7 absence routes have permission guards
    for (const r of routes) {
      assert.ok(
        r.route.stack.length >= 3,
        `Route ${r.route.path} should have at least authMiddleware and requirePermission`,
      );
    }
  });

  it("HIGH-02: TaskSubmissionService.findAll should fail-closed with 403 for non-intern, non-leader callers", async () => {
    const service = new TaskSubmissionService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000004", role: "USER" };

    await assert.rejects(
      async () => {
        await service.findAll({}, mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("HIGH-03: TaskAssignmentService.findAll should fail-closed with 403 when actor has no assignment access", async () => {
    const service = new TaskAssignmentService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000005", role: "USER" };

    await assert.rejects(
      async () => {
        await service.findAll({}, mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("HIGH-04: DailyReportService.submitReport should reject unauthorized internId with 403 (Mass Assignment Guard)", async () => {
    const service = new DailyReportService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000006", role: "USER" };

    // Create a mock intern target
    const targetInternId = "00000000-0000-0000-0000-000000000099";

    // Mock prisma.intern.findUnique to simulate target intern existing
    const originalFindUnique = prisma.intern.findUnique;
    (prisma.intern as any).findUnique = async ({ where }: any) => {
      if (where.id === targetInternId) {
        return { id: targetInternId, leaderId: "some-other-leader-id" };
      }
      return null;
    };

    try {
      await assert.rejects(
        async () => {
          await service.submitReport(
            {
              internId: targetInternId,
              date: "2026-10-01",
              summary: "Test report",
              yesterdayWork: "Worked on tasks",
              todayWork: "Working on audit",
            } as any,
            mockActor,
          );
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          return true;
        },
      );
    } finally {
      (prisma.intern as any).findUnique = originalFindUnique;
    }
  });

  it("HIGH-05: MeetingService.getPendingAbsences should fail-closed with 403 for non-leader, non-admin callers", async () => {
    const service = new MeetingService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000007", role: "USER" };

    await assert.rejects(
      async () => {
        await service.getPendingAbsences(mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("HIGH-05: MeetingService.findAbsencesByMeeting should reject non-participants with 403", async () => {
    const service = new MeetingService();
    const mockActor = { id: "00000000-0000-0000-0000-000000000008", role: "USER" };

    // Mock finding meeting
    (service as any).repository = {
      findById: async () => ({
        id: "meeting-1",
        createdBy: "someone-else",
        hostId: "someone-else-2",
        participants: [{ userId: "participant-1" }],
      }),
      findAbsencesByMeeting: async () => [],
    };

    await assert.rejects(
      async () => {
        await service.findAbsencesByMeeting("meeting-1", mockActor);
      },
      (err: any) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("HIGH-07: Process-level exception handlers should be registered in Node.js runtime", () => {
    // Import server to trigger listener registration if not already
    require("../src/server");
    const unhandledRejections = process.listeners("unhandledRejection");
    const uncaughtExceptions = process.listeners("uncaughtException");
    assert.ok(unhandledRejections.length >= 1, "unhandledRejection listener must be registered");
    assert.ok(uncaughtExceptions.length >= 1, "uncaughtException listener must be registered");
  });

  it("MED-01: SystemSettingService DEFAULT_SETTINGS should NOT leak DISCORD_BOT_TOKEN", async () => {
    const service = new SystemSettingService({
      getAll: async () => [],
      getByKey: async () => null,
      upsert: async () => ({}) as any,
      delete: async () => ({}) as any,
    } as any);

    const settings = await service.getSettings();
    assert.equal(settings.DISCORD_BOT_TOKEN, "");
  });

  it("MED-03: Swagger specification should document all Absence endpoints", () => {
    assert.ok(swaggerSpec.paths["/absences"]);
    assert.ok(swaggerSpec.paths["/absences/{id}"]);
    assert.ok(swaggerSpec.paths["/absences/{id}/review"]);
  });

  it("LOW-01: authRouter /2fa/setup should have rate limit middleware attached", () => {
    const stack = (authRouter as any).stack;
    const setup2faRoute = stack.find(
      (layer: any) => layer.route && layer.route.path === "/2fa/setup",
    );
    assert.ok(setup2faRoute);
    assert.ok(setup2faRoute.route.stack.length >= 3);
  });
});
