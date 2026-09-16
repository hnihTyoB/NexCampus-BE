import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderEmailTemplate,
} from "../src/queues/templates/email-templates";
import {
  QUEUE_NAMES,
  dispatchEmailJob,
  dispatchNotificationJob,
  dispatchCleanupJob,
} from "../src/queues/index";
import { processEmailJob } from "../src/queues/workers/email.worker";
import {
  cleanupOrphanedStorage,
  cleanupExpiredDatabaseRecords,
  processCleanupJob,
} from "../src/queues/workers/cleanup.worker";
import { processNotificationJob } from "../src/queues/workers/notification.worker";
import { MailService } from "../src/common/services/mail.service";
import { R2Service } from "../src/common/services/r2.service";
import { prisma } from "../src/database/prisma.client";
import { notificationRepository } from "../src/modules/notification/notification.repository";
import { sseManagerService } from "../src/common/services/sse-manager.service";

describe("BullMQ Asynchronous Queues & Background Workers Suite", () => {
  // ─── 1. Handlebars Template Engine ─────────────────────────────────────────
  describe("1. Handlebars Email Templates & Rendering Engine", () => {
    it("should render INVITE_APPLICATION template with link and expiry", () => {
      const email = renderEmailTemplate("INVITE_APPLICATION", {
        candidateEmail: "candidate@example.com",
        applyUrl: "https://nexcampus.com/onboarding/token-123",
        expiresAt: "2026-09-25",
      });

      assert.match(
        email.subject,
        /\[NexCampus\] Thư mời ứng tuyển và hoàn thiện hồ sơ thực tập/,
      );
      assert.match(email.html, /candidate@example\.com/);
      assert.match(email.html, /https:\/\/nexcampus\.com\/onboarding\/token-123/);
      assert.match(email.html, /2026-09-25/);
      assert.match(email.html, /NexCampus/);
    });

    it("should render INTERN_ACCOUNT_CREATED template with temporary password and department", () => {
      const email = renderEmailTemplate("INTERN_ACCOUNT_CREATED", {
        fullName: "Nguyễn Văn Thực Tập",
        email: "intern@nexcampus.com",
        temporaryPassword: "Nx@SecretPass123!",
        loginUrl: "https://nexcampus.com/login",
        departmentName: "Phòng Công nghệ Thông tin",
        positionTitle: "Backend Developer",
        startDate: "2026-10-01",
      });

      assert.match(
        email.subject,
        /Chúc mừng bạn đã được phê duyệt thực tập/,
      );
      assert.match(email.html, /Nguyễn Văn Thực Tập/);
      assert.match(email.html, /intern@nexcampus\.com/);
      assert.match(email.html, /Nx@SecretPass123!/);
      assert.match(email.html, /Phòng Công nghệ Thông tin/);
      assert.match(email.html, /Backend Developer/);
      assert.match(email.html, /2026-10-01/);
      assert.match(email.html, /Đổi mật khẩu ngay sau lần đăng nhập đầu tiên/i);
    });

    it("should render RESET_PASSWORD template with reset link and expiry", () => {
      const email = renderEmailTemplate("RESET_PASSWORD", {
        fullName: "Lê Văn B",
        resetUrl: "https://nexcampus.com/reset-password?token=abc-reset-xyz",
        expiresIn: "1 giờ",
      });

      assert.match(email.subject, /Yêu cầu đặt lại mật khẩu tài khoản/);
      assert.match(email.html, /Lê Văn B/);
      assert.match(email.html, /token=abc-reset-xyz/);
      assert.match(email.html, /1 giờ/);
    });

    it("should render DAILY_REPORT_REMINDER template with reportDate and submit link", () => {
      const email = renderEmailTemplate("DAILY_REPORT_REMINDER", {
        internName: "Trần Thị C",
        reportDate: "16/09/2026",
        submitUrl: "https://nexcampus.com/reports/daily",
      });

      assert.match(email.subject, /16\/09\/2026/);
      assert.match(email.html, /Trần Thị C/);
      assert.match(email.html, /16\/09\/2026/);
      assert.match(email.html, /https:\/\/nexcampus\.com\/reports\/daily/);
    });

    it("should escape HTML in dynamic variables to protect against XSS injections", () => {
      const email = renderEmailTemplate("RESET_PASSWORD", {
        fullName: '<script>alert("XSS")</script>',
        resetUrl: "https://nexcampus.com/safe",
      });

      assert.equal(email.html.includes('<script>alert("XSS")</script>'), false);
      assert.match(email.html, /&lt;script&gt;alert/);
    });
  });

  // ─── 2. Queues & Dispatchers ──────────────────────────────────────────────
  describe("2. Core Queues & Job Dispatchers", () => {
    it("should expose standard queue names", () => {
      assert.equal(QUEUE_NAMES.EMAIL, "email-queue");
      assert.equal(QUEUE_NAMES.NOTIFICATION, "notification-queue");
      assert.equal(QUEUE_NAMES.CLEANUP, "cleanup-queue");
    });

    it("dispatchEmailJob should handle dispatching gracefully in test environment", async () => {
      const result = await dispatchEmailJob({
        type: "INVITE_APPLICATION",
        to: "test@example.com",
        data: { candidateEmail: "test@example.com", applyUrl: "https://example.com" },
      });

      assert.ok(result);
      assert.ok(typeof result.id === "string" || result.dispatched);
    });

    it("dispatchNotificationJob should handle dispatching gracefully in test environment", async () => {
      const result = await dispatchNotificationJob({
        type: "INFO",
        userId: "user-123",
        title: "Thông báo test",
        content: "Nội dung kiểm tra queue",
      });

      assert.ok(result);
      assert.ok(typeof result.id === "string" || result.dispatched);
    });

    it("dispatchCleanupJob should handle dispatching gracefully in test environment", async () => {
      const result = await dispatchCleanupJob({
        type: "FULL_CLEANUP",
        retentionHours: 2,
      });

      assert.ok(result);
      assert.ok(typeof result.id === "string" || result.dispatched);
    });
  });

  // ─── 3. Email Worker Execution ────────────────────────────────────────────
  describe("3. Email Worker Execution & Retry Behavior", () => {
    it("processEmailJob should render template and invoke mailService.sendRaw", async () => {
      let sentMail: { to: string; subject: string; html: string } | null = null;
      const originalSendRaw = MailService.prototype.sendRaw;
      MailService.prototype.sendRaw = async (to, subject, html) => {
        sentMail = { to, subject, html };
      };

      const mockJob: any = {
        id: "job-email-1",
        name: "INVITE_APPLICATION",
        data: {
          type: "INVITE_APPLICATION",
          to: "applicant@gmail.com",
          data: {
            candidateEmail: "applicant@gmail.com",
            applyUrl: "https://nexcampus.com/apply/1",
          },
        },
      };

      await processEmailJob(mockJob);

      assert.ok(sentMail);
      assert.equal((sentMail as any).to, "applicant@gmail.com");
      assert.match((sentMail as any).html, /https:\/\/nexcampus\.com\/apply\/1/);

      MailService.prototype.sendRaw = originalSendRaw;
    });

    it("processEmailJob should propagate errors when sendRaw fails for BullMQ retry", async () => {
      const originalSendRaw = MailService.prototype.sendRaw;
      MailService.prototype.sendRaw = async () => {
        throw new Error("SMTP connection failed: 550 Relaying denied");
      };

      const mockJob: any = {
        id: "job-email-fail",
        name: "RESET_PASSWORD",
        data: {
          type: "RESET_PASSWORD",
          to: "user@test.com",
          data: { fullName: "Tester", resetUrl: "https://test.com" },
        },
      };

      await assert.rejects(
        async () => {
          await processEmailJob(mockJob);
        },
        (err: Error) => {
          assert.match(err.message, /SMTP connection failed/);
          return true;
        },
      );

      MailService.prototype.sendRaw = originalSendRaw;
    });
  });

  // ─── 4. Storage & Database Cleanup Worker ─────────────────────────────────
  describe("4. Storage & Database Cleanup Worker", () => {
    it("cleanupOrphanedStorage should delete orphaned files and preserve active ones", async () => {
      const originalList = R2Service.prototype.listObjects;
      const originalDelete = R2Service.prototype.deleteFiles;
      const originalTaskAttachments = (prisma.taskAttachment as any).findMany;

      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      // Mock R2 listing with 3 files in tasks/
      R2Service.prototype.listObjects = async (prefix?: string) => {
        if (prefix === "tasks/") {
          return [
            { key: "tasks/active-file.pdf", lastModified: fourHoursAgo },
            { key: "tasks/orphaned-old-file.zip", lastModified: fourHoursAgo },
            { key: "tasks/in-progress-recent-file.png", lastModified: thirtyMinutesAgo },
          ];
        }
        return [];
      };

      // Mock DB: only "tasks/active-file.pdf" is referenced in DB
      (prisma.taskAttachment as any).findMany = async () => [
        { filePath: "tasks/active-file.pdf" },
      ];

      let deletedKeys: string[] = [];
      R2Service.prototype.deleteFiles = async (keys: string[]) => {
        deletedKeys = keys;
      };

      const results = await cleanupOrphanedStorage(["tasks/"], 2);

      // orphaned-old-file.zip is older than 2 hours and not in DB -> should be deleted
      // in-progress-recent-file.png is only 30m old -> protected by safety margin
      // active-file.pdf is referenced in DB -> protected
      assert.equal(deletedKeys.length, 1);
      assert.equal(deletedKeys[0], "tasks/orphaned-old-file.zip");
      assert.equal(results["tasks/"], 1);

      R2Service.prototype.listObjects = originalList;
      R2Service.prototype.deleteFiles = originalDelete;
      (prisma.taskAttachment as any).findMany = originalTaskAttachments;
    });

    it("cleanupExpiredDatabaseRecords should delete expired tokens and invites", async () => {
      const origReset = (prisma.passwordResetToken as any).deleteMany;
      const origVerify = (prisma.verificationToken as any).deleteMany;
      const origInvite = (prisma.applicationInvite as any).deleteMany;

      (prisma.passwordResetToken as any).deleteMany = async () => ({ count: 5 });
      (prisma.verificationToken as any).deleteMany = async () => ({ count: 12 });
      (prisma.applicationInvite as any).deleteMany = async () => ({ count: 3 });

      const stats = await cleanupExpiredDatabaseRecords();

      assert.equal(stats.passwordResetTokens, 5);
      assert.equal(stats.verificationTokens, 12);
      assert.equal(stats.expiredApplicationInvites, 3);

      (prisma.passwordResetToken as any).deleteMany = origReset;
      (prisma.verificationToken as any).deleteMany = origVerify;
      (prisma.applicationInvite as any).deleteMany = origInvite;
    });

    it("processCleanupJob should orchestrate FULL_CLEANUP", async () => {
      const origList = R2Service.prototype.listObjects;
      const origDelete = R2Service.prototype.deleteFiles;
      R2Service.prototype.listObjects = async () => [];
      R2Service.prototype.deleteFiles = async () => {};

      const origReset = (prisma.passwordResetToken as any).deleteMany;
      const origVerify = (prisma.verificationToken as any).deleteMany;
      const origInvite = (prisma.applicationInvite as any).deleteMany;

      (prisma.passwordResetToken as any).deleteMany = async () => ({ count: 2 });
      (prisma.verificationToken as any).deleteMany = async () => ({ count: 1 });
      (prisma.applicationInvite as any).deleteMany = async () => ({ count: 0 });

      const mockJob: any = {
        id: "cleanup-job-1",
        name: "FULL_CLEANUP",
        data: {
          type: "FULL_CLEANUP",
          retentionHours: 2,
        },
      };

      const result = await processCleanupJob(mockJob);

      assert.ok(result);
      assert.equal(result.expiredDbRecords.passwordResetTokens, 2);
      assert.equal(result.expiredDbRecords.verificationTokens, 1);
      assert.ok(typeof result.durationMs === "number");

      R2Service.prototype.listObjects = origList;
      R2Service.prototype.deleteFiles = origDelete;
      (prisma.passwordResetToken as any).deleteMany = origReset;
      (prisma.verificationToken as any).deleteMany = origVerify;
      (prisma.applicationInvite as any).deleteMany = origInvite;
    });
  });

  // ─── 5. Notification Worker Execution ─────────────────────────────────────
  describe("5. Notification Worker Execution", () => {
    it("processNotificationJob should create in-app notification and broadcast SSE", async () => {
      let createdNotif: any = null;
      let sseDispatched: any = null;

      const origCreate = notificationRepository.createSingleNotification;
      notificationRepository.createSingleNotification = async (data: any) => {
        createdNotif = { id: "notif-uuid-1", createdAt: new Date(), ...data };
        return createdNotif;
      };

      const origSendToUser = sseManagerService.sendToUser;
      sseManagerService.sendToUser = (userId: string, event: any) => {
        sseDispatched = { userId, event };
      };

      const mockJob: any = {
        id: "notif-job-1",
        name: "TASK_ASSIGNED",
        data: {
          type: "TASK",
          userId: "user-target-id",
          title: "Bạn có công việc mới",
          content: "Hãy kiểm tra danh sách nhiệm vụ của bạn",
          data: { taskId: "task-1" },
        },
      };

      await processNotificationJob(mockJob);

      assert.ok(createdNotif);
      assert.equal(createdNotif.userId, "user-target-id");
      assert.equal(createdNotif.title, "Bạn có công việc mới");

      assert.ok(sseDispatched);
      assert.equal(sseDispatched.userId, "user-target-id");
      assert.equal(sseDispatched.event.type, "NOTIFICATION");

      notificationRepository.createSingleNotification = origCreate;
      sseManagerService.sendToUser = origSendToUser;
    });
  });
});
