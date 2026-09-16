import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import { ROLES } from "../src/common/constants/role.constant";
import { AppError } from "../src/common/errors/app-error";
import { renderTemplateString } from "../src/common/helpers/template.helper";
import {
  createNotificationTemplateSchema,
} from "../src/modules/notification/notification.validation";
import {
  updateNotificationSettingSchema,
} from "../src/modules/notification-settings/notification-setting.validation";
import { NotificationSettingService } from "../src/modules/notification-settings/notification-setting.service";
import {
  createMeetingSchema,
  updateMeetingAttendanceSchema,
} from "../src/modules/meetings/meeting.validation";
import { MeetingService } from "../src/modules/meetings/meeting.service";
import {
  activityLogQuerySchema,
} from "../src/modules/activity-logs/activity-log.validation";
import {
  ActivityLogService,
  createAuditLog,
} from "../src/modules/activity-logs/activity-log.service";
import { MeetingType } from "@prisma/client";

describe("Notifications, Meetings & Activity Logs Suite", () => {
  // ─── 1. Constants, Error Codes & Permissions ──────────────────────────────
  describe("1. Constants, Error Codes & Permissions", () => {
    it("should export new error codes correctly", () => {
      assert.equal(ERROR_CODE.NOTIFICATION_NOT_FOUND, "NOTIFICATION_NOT_FOUND");
      assert.equal(ERROR_CODE.TEMPLATE_NOT_FOUND, "TEMPLATE_NOT_FOUND");
      assert.equal(ERROR_CODE.AUDIT_LOG_NOT_FOUND, "AUDIT_LOG_NOT_FOUND");
      assert.equal(ERROR_CODE.PAST_DATE_NOT_ALLOWED, "PAST_DATE_NOT_ALLOWED");
      assert.equal(ERROR_CODE.MEETING_NOT_FOUND, "MEETING_NOT_FOUND");
    });

    it("should export notification, template and audit permissions and aliases", () => {
      assert.equal(PERMISSIONS.AUDIT_LOG_VIEW, "AUDIT_LOG_READ");
      assert.equal(PERMISSIONS.AUDIT_LOG_READ, "AUDIT_LOG_READ");
      assert.equal(PERMISSIONS.TEMPLATE_MANAGE, "NOTIFICATION_TEMPLATE_MANAGE");
      assert.equal(
        PERMISSIONS.NOTIFICATION_SETTING_READ,
        "NOTIFICATION_SETTING_READ",
      );
      assert.equal(
        PERMISSIONS.NOTIFICATION_SETTING_UPDATE,
        "NOTIFICATION_SETTING_UPDATE",
      );
    });

    it("should export audit actions and target types for new modules", () => {
      assert.equal(
        AUDIT_ACTION.UPDATE_NOTIFICATION_SETTING,
        "UPDATE_NOTIFICATION_SETTING",
      );
      assert.equal(
        AUDIT_ACTION.UPDATE_MEETING_ATTENDANCE,
        "UPDATE_MEETING_ATTENDANCE",
      );
      assert.equal(
        AUDIT_TARGET_TYPE.NOTIFICATION_SETTING,
        "NOTIFICATION_SETTING",
      );
      assert.equal(AUDIT_TARGET_TYPE.AUDIT_LOG, "AUDIT_LOG");
    });
  });

  // ─── 2. Notification Settings & Templates ─────────────────────────────────
  describe("2. Notification Settings & Templates Validation and Logic", () => {
    it("should validate updateNotificationSettingSchema with boolean event toggles", () => {
      const valid = updateNotificationSettingSchema.safeParse({
        emailEnabled: true,
        inAppEnabled: true,
        taskAssignedEmail: true,
        taskAssignedInApp: false,
        submissionReviewedEmail: true,
        submissionReviewedInApp: true,
        dailyReportReminderEmail: false,
        dailyReportReminderInApp: true,
        meetingScheduleEmail: true,
        meetingScheduleInApp: true,
      });
      assert.equal(valid.success, true);
    });

    it("should allow partial updates in updateNotificationSettingSchema", () => {
      const valid = updateNotificationSettingSchema.safeParse({
        taskAssignedEmail: false,
      });
      assert.equal(valid.success, true);
    });

    it("should reject invalid non-boolean types in updateNotificationSettingSchema", () => {
      const invalid = updateNotificationSettingSchema.safeParse({
        emailEnabled: "yes",
      });
      assert.equal(invalid.success, false);
    });

    it("should support eventCode alias in createNotificationTemplateSchema", () => {
      const parsed = createNotificationTemplateSchema.safeParse({
        eventCode: "NEW_TASK_ASSIGNED",
        name: "Giao việc mới",
        channels: ["WEB", "EMAIL"],
        title: "Bạn có công việc mới: {{taskTitle}}",
        content: "Chào {{internName}}, bạn đã được giao việc: {{taskTitle}}.",
        variables: ["internName", "taskTitle"],
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.code, "NEW_TASK_ASSIGNED");
      }
    });

    it("should interpolate placeholders in notification template string", () => {
      const template =
        "Chào {{internName}}, bạn có lịch họp mới tại {{meetingLink}} cho task {{taskTitle}}.";
      const rendered = renderTemplateString(template, {
        internName: "Trần Văn A",
        meetingLink: "https://meet.google.com/xyz-abc",
        taskTitle: "Thiết kế API V2",
      });

      assert.equal(
        rendered,
        "Chào Trần Văn A, bạn có lịch họp mới tại https://meet.google.com/xyz-abc cho task Thiết kế API V2.",
      );
    });

    it("NotificationSettingService should fetch default settings and trigger audit log upon update", async () => {
      const service = new NotificationSettingService();

      let auditCreated: any = null;
      let updateDataSaved: any = null;

      (service as any).repository = {
        findOrCreateDefault: async (userId: string) => ({
          id: "setting-1",
          userId,
          emailEnabled: true,
          inAppEnabled: true,
          webEnabled: true,
          taskAssignedEmail: true,
          taskAssignedInApp: true,
          submissionReviewedEmail: true,
          submissionReviewedInApp: true,
          dailyReportReminderEmail: true,
          dailyReportReminderInApp: true,
          meetingScheduleEmail: true,
          meetingScheduleInApp: true,
        }),
        update: async (userId: string, data: any) => {
          updateDataSaved = { userId, ...data };
          return {
            id: "setting-1",
            userId,
            emailEnabled: data.emailEnabled ?? true,
            inAppEnabled: true,
            webEnabled: true,
            taskAssignedEmail: data.taskAssignedEmail ?? true,
            taskAssignedInApp: true,
            submissionReviewedEmail: true,
            submissionReviewedInApp: true,
            dailyReportReminderEmail: true,
            dailyReportReminderInApp: true,
            meetingScheduleEmail: true,
            meetingScheduleInApp: true,
          };
        },
        createAuditLog: async (log: any) => {
          auditCreated = log;
        },
      };

      const settings = await service.getSettings("u-1");
      assert.equal(settings.userId, "u-1");
      assert.equal(settings.emailEnabled, true);

      const updated = await service.updateSettings(
        "u-1",
        { emailEnabled: false, taskAssignedEmail: false },
        { ipAddress: "192.168.1.1" },
      );

      assert.equal(updated.emailEnabled, false);
      assert.equal(updateDataSaved.emailEnabled, false);
      assert.equal(updateDataSaved.taskAssignedEmail, false);
      assert.equal(
        auditCreated.action,
        AUDIT_ACTION.UPDATE_NOTIFICATION_SETTING,
      );
      assert.equal(
        auditCreated.targetType,
        AUDIT_TARGET_TYPE.NOTIFICATION_SETTING,
      );
      assert.equal(auditCreated.ipAddress, "192.168.1.1");
    });
  });

  // ─── 3. Meetings & Attendance ─────────────────────────────────────────────
  describe("3. Meetings Constraints & Attendance Management", () => {
    it("should validate createMeetingSchema with departmentId and valid time order", () => {
      const valid = createMeetingSchema.safeParse({
        title: "Họp phòng ban tuần 38",
        meetingType: MeetingType.ONLINE,
        startTime: new Date("2026-09-22T09:00:00Z"),
        endTime: new Date("2026-09-22T10:00:00Z"),
        departmentId: "d1111111-1111-1111-1111-111111111111",
        meetUrl: "https://meet.google.com/abc-defg-hij",
      });
      assert.equal(valid.success, true);
    });

    it("should reject meeting when endTime <= startTime", () => {
      const invalid = createMeetingSchema.safeParse({
        title: "Họp sai giờ",
        meetingType: MeetingType.ONLINE,
        startTime: new Date("2026-09-22T10:00:00Z"),
        endTime: new Date("2026-09-22T09:30:00Z"),
      });
      assert.equal(invalid.success, false);
    });

    it("should validate updateMeetingAttendanceSchema correctly", () => {
      const valid = updateMeetingAttendanceSchema.safeParse({
        minutes: "Đã thống nhất kiến trúc phân tầng V2 cho 3 module",
        attendances: [
          {
            userId: "11111111-1111-1111-1111-111111111111",
            status: "ACCEPTED",
            notes: "Có mặt đúng giờ",
          },
          {
            userId: "22222222-2222-2222-2222-222222222222",
            status: "DECLINED",
            notes: "Vắng có phép",
          },
        ],
      });
      assert.equal(valid.success, true);
    });

    it("should reject invalid participant status in updateMeetingAttendanceSchema", () => {
      const invalid = updateMeetingAttendanceSchema.safeParse({
        attendances: [
          {
            userId: "11111111-1111-1111-1111-111111111111",
            status: "UNKNOWN_STATUS",
          },
        ],
      });
      assert.equal(invalid.success, false);
    });

    it("MeetingService updateAttendance should forbid non-host/non-creator intern", async () => {
      const meetingService = new MeetingService();

      (meetingService as any).repository = {
        findById: async () => ({
          id: "m-1",
          title: "Daily Sync",
          createdBy: "host-leader-id",
          hostId: "host-leader-id",
          departmentId: "dept-1",
        }),
      };

      await assert.rejects(
        async () => {
          await meetingService.updateAttendance(
            "m-1",
            { minutes: "Test minutes" },
            { id: "other-intern-id", role: ROLES.INTERN },
          );
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("MeetingService updateAttendance should allow host/creator and record audit log", async () => {
      const meetingService = new MeetingService();

      let auditCreated: any = null;
      let attendanceSaved: any = null;

      (meetingService as any).repository = {
        findById: async () => ({
          id: "m-1",
          title: "Daily Sync",
          createdBy: "host-leader-id",
          hostId: "host-leader-id",
          departmentId: "dept-1",
        }),
        updateAttendanceAndMinutes: async (id: string, data: any) => {
          attendanceSaved = { id, ...data };
          return { id, ...data };
        },
        createAuditLog: async (log: any) => {
          auditCreated = log;
        },
      };

      const result = await meetingService.updateAttendance(
        "m-1",
        {
          minutes: "Biên bản cuộc họp V2",
          attendances: [
            {
              userId: "intern-1",
              status: "ACCEPTED",
            },
          ],
        },
        { id: "host-leader-id", role: ROLES.LEADER },
        { ipAddress: "10.0.0.1" },
      );

      assert.equal(result.id, "m-1");
      assert.equal(attendanceSaved.minutes, "Biên bản cuộc họp V2");
      assert.equal(
        auditCreated.action,
        AUDIT_ACTION.UPDATE_MEETING_ATTENDANCE,
      );
      assert.equal(auditCreated.targetType, AUDIT_TARGET_TYPE.MEETING);
      assert.equal(auditCreated.ipAddress, "10.0.0.1");
    });
  });

  // ─── 4. Activity Logs ─────────────────────────────────────────────────────
  describe("4. Activity Logs Query and Central Logging Helper", () => {
    it("should validate activityLogQuerySchema and coerce pagination numbers", () => {
      const parsed = activityLogQuerySchema.safeParse({
        page: "2",
        limit: "25",
        actorId: "11111111-1111-1111-1111-111111111111",
        action: "CREATE_TASK",
        targetType: "TASK",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-15T23:59:59.000Z",
      });

      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 25);
        assert.equal(parsed.data.actorId, "11111111-1111-1111-1111-111111111111");
        assert.equal(parsed.data.action, "CREATE_TASK");
        assert.equal(parsed.data.targetType, "TASK");
        assert.equal(parsed.data.from, "2026-09-01T00:00:00.000Z");
        assert.equal(parsed.data.to, "2026-09-15T23:59:59.000Z");
      }
    });

    it("should reject invalid date strings in activityLogQuerySchema", () => {
      const invalid = activityLogQuerySchema.safeParse({
        from: "not-a-date",
      });
      assert.equal(invalid.success, false);
    });

    it("ActivityLogService findById should throw AUDIT_LOG_NOT_FOUND when log is missing", async () => {
      const service = new ActivityLogService();

      (service as any).repository = {
        findById: async () => null,
      };

      await assert.rejects(
        async () => {
          await service.findById("non-existent-log-id");
        },
        (err: AppError) => {
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, ERROR_CODE.AUDIT_LOG_NOT_FOUND);
          return true;
        },
      );
    });

    it("ActivityLogService findAll should return list with pagination meta", async () => {
      const service = new ActivityLogService();

      (service as any).repository = {
        findMany: async (query: any) => ({
          data: [
            {
              id: "log-1",
              actorId: "u-1",
              action: AUDIT_ACTION.CREATE_TASK,
              targetType: AUDIT_TARGET_TYPE.TASK,
              targetId: "task-1",
              details: { title: "New Task" },
              ipAddress: "127.0.0.1",
              createdAt: new Date(),
            },
          ],
          meta: {
            page: query.page ?? 1,
            limit: query.limit ?? 20,
            total: 1,
            totalPages: 1,
          },
        }),
      };

      const result = await service.findAll({ page: 1, limit: 10 });
      assert.equal(result.data.length, 1);
      assert.equal(result.meta.page, 1);
      assert.equal(result.meta.total, 1);
    });

    it("createAuditLog helper should invoke activity log service without throwing", async () => {
      let createdLog: any = null;
      (ActivityLogService.prototype as any).log = async (data: any) => {
        createdLog = data;
        return { id: "log-created", ...data };
      };

      const result = await createAuditLog({
        actorId: "admin-1",
        action: AUDIT_ACTION.APPROVE_APPLICATION,
        targetType: AUDIT_TARGET_TYPE.APPLICATION,
        targetId: "app-1",
        details: { status: "APPROVED" },
        ipAddress: "127.0.0.1",
      });

      assert.ok(result);
      assert.equal(createdLog.actorId, "admin-1");
      assert.equal(createdLog.action, AUDIT_ACTION.APPROVE_APPLICATION);
      assert.equal(createdLog.targetType, AUDIT_TARGET_TYPE.APPLICATION);
    });
  });
});
