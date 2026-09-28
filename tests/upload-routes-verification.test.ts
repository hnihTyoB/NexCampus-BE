import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { jwtConfig } from "../src/config/jwt.config";
import { R2Service } from "../src/common/services/r2.service";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { AuthRepository } from "../src/modules/auth/auth.repository";
import { TaskRepository } from "../src/modules/tasks/task.repository";
import { TaskSubmissionRepository } from "../src/modules/task-submissions/task-submission.repository";
import { DailyReportRepository } from "../src/modules/daily-reports/daily-report.repository";
import { ApplicationRepository } from "../src/modules/applications/application.repository";
import { APPLICATION_INVITE_STATUS } from "../src/common/constants/application.constant";

describe("Comprehensive File Upload Endpoints Verification", () => {
  let server: http.Server;
  let baseUrl: string;
  let token: string;
  const mockUserId = "11111111-1111-1111-1111-111111111111";
  const mockRoleId = "22222222-2222-2222-2222-222222222222";
  const mockTaskId = "33333333-3333-3333-3333-333333333333";
  const mockSubId = "44444444-4444-4444-4444-444444444444";
  const mockReportId = "55555555-5555-5555-5555-555555555555";

  // Stubs references
  const originalGetPresigned = R2Service.prototype.getPresignedUploadUrl;
  const originalGetPublicUrl = R2Service.prototype.getPublicUrl;
  const originalGetRolePermissions = permissionCacheService.getRolePermissions;
  const originalGetUserPermissions = permissionCacheService.getUserPermissions;
  const originalGetUserState = permissionCacheService.getUserState;

  const originalAuthFindById = AuthRepository.prototype.findById;
  const originalAuthUpdateProfile = AuthRepository.prototype.updateProfile;
  const originalTaskFindById = TaskRepository.prototype.findById;
  const originalTaskFindAttachments = TaskRepository.prototype.findAttachmentsByTaskId;
  const originalSubFindById = TaskSubmissionRepository.prototype.findById;
  const originalReportFindById = DailyReportRepository.prototype.findById;
  const originalAppFindInvite = ApplicationRepository.prototype.findInviteByToken;

  before(async () => {
    R2Service.prototype.getPresignedUploadUrl = async (key: string) =>
      `https://mock-r2.test/${key}`;
    R2Service.prototype.getPublicUrl = (key: string) =>
      `https://pub-r2.test/${key}`;

    const allPermissions = [
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.USER_ROLE_ASSIGN,
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_ATTACHMENT_UPLOAD,
      PERMISSIONS.TASK_ATTACHMENT_DELETE,
      PERMISSIONS.TASK_SUBMISSION_CREATE,
      PERMISSIONS.TASK_SUBMISSION_READ,
      PERMISSIONS.TASK_SUBMISSION_DELETE,
      PERMISSIONS.DAILY_REPORT_CREATE,
      PERMISSIONS.DAILY_REPORT_READ,
      PERMISSIONS.DAILY_REPORT_DELETE,
      PERMISSIONS.DAILY_REPORT_FEEDBACK,
    ];

    permissionCacheService.getRolePermissions = async () => new Set(allPermissions);
    permissionCacheService.getUserPermissions = async () => allPermissions;
    permissionCacheService.getUserState = async (userId: string) => ({
      id: userId,
      isActive: true,
      deletedAt: null,
      roleId: mockRoleId,
      roleName: "ADMIN",
    });

    // Mock prototype methods
    AuthRepository.prototype.findById = (async (id: string) => ({
      id,
      email: "test-upload@nexcampus.test",
      fullName: "Test User",
      avatarUrl: null,
      roleId: mockRoleId,
      role: { id: mockRoleId, name: "ADMIN", isSystem: true },
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;

    AuthRepository.prototype.updateProfile = (async (id: string, data: any) => ({
      id,
      ...data,
    })) as any;

    TaskRepository.prototype.findById = (async (id: string) => ({
      id,
      title: "Test Task",
      createdBy: mockUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;

    TaskRepository.prototype.findAttachmentsByTaskId = (async () => []) as any;

    TaskSubmissionRepository.prototype.findById = (async (id: string) => ({
      id,
      assignmentId: "mock-assignment-id",
      assignment: {
        internId: mockUserId,
      },
      internId: mockUserId,
      videoDemo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;

    DailyReportRepository.prototype.findById = (async (id: string) => ({
      id,
      internId: mockUserId,
      intern: {
        user: {
          id: mockUserId,
        },
      },
      videoDemo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;

    ApplicationRepository.prototype.findInviteByToken = (async (token: string) => ({
      id: "mock-invite-id",
      token,
      email: "candidate@test.com",
      status: APPLICATION_INVITE_STATUS.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any;

    token = jwt.sign(
      {
        id: mockUserId,
        email: "test-upload@nexcampus.test",
        role: "ADMIN",
        roleId: mockRoleId,
      },
      jwtConfig.accessSecret,
      { expiresIn: "1h" },
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}/api/v2`;
        resolve();
      });
    });
  });

  after(async () => {
    R2Service.prototype.getPresignedUploadUrl = originalGetPresigned;
    R2Service.prototype.getPublicUrl = originalGetPublicUrl;
    permissionCacheService.getRolePermissions = originalGetRolePermissions;
    permissionCacheService.getUserPermissions = originalGetUserPermissions;
    permissionCacheService.getUserState = originalGetUserState;

    AuthRepository.prototype.findById = originalAuthFindById;
    AuthRepository.prototype.updateProfile = originalAuthUpdateProfile;
    TaskRepository.prototype.findById = originalTaskFindById;
    TaskRepository.prototype.findAttachmentsByTaskId = originalTaskFindAttachments;
    TaskSubmissionRepository.prototype.findById = originalSubFindById;
    DailyReportRepository.prototype.findById = originalReportFindById;
    ApplicationRepository.prototype.findInviteByToken = originalAppFindInvite;

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe("1. Avatar Upload Routes (/users and /auth)", () => {
    it("should accept GET /users/avatar/upload-url with mimeType query param", async () => {
      const res = await fetch(
        `${baseUrl}/users/avatar/upload-url?mimeType=image%2Fjpeg`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl, "must have uploadUrl");
      assert.ok(json.data.key, "must have key");
      assert.ok(json.data.filePath, "must have filePath");
      assert.equal(json.data.filePath, json.data.key);
    });

    it("should accept POST /users/avatar/upload-url with contentType body", async () => {
      const res = await fetch(`${baseUrl}/users/avatar/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentType: "image/jpeg" }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
    });

    it("should accept POST /users/avatar/confirm route with filePath", async () => {
      const res = await fetch(`${baseUrl}/users/avatar/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filePath: `avatars/${mockUserId}/123456789.jpeg`,
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.avatarUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should preserve GET /auth/avatar/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/auth/avatar/upload-url?mimeType=image%2Fpng`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should preserve POST /auth/avatar/upload-url", async () => {
      const res = await fetch(`${baseUrl}/auth/avatar/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentType: "image/png" }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
    });

    it("should preserve POST /auth/avatar/confirm with key", async () => {
      const res = await fetch(`${baseUrl}/auth/avatar/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: `avatars/${mockUserId}/123456789.png`,
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.avatarUrl);
      assert.ok(json.data.filePath);
    });
  });

  describe("2. Task Attachments Upload Routes", () => {
    it("should accept GET /tasks/:taskId/attachments/upload-url with mimeType", async () => {
      const res = await fetch(
        `${baseUrl}/tasks/${mockTaskId}/attachments/upload-url?fileName=file.pdf&mimeType=application%2Fpdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should route POST /tasks/:taskId/attachments/confirm without route 404", async () => {
      const res = await fetch(
        `${baseUrl}/tasks/${mockTaskId}/attachments/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath: "tasks/task-1/file.pdf",
            fileName: "file.pdf",
            mimeType: "application/pdf",
            fileSize: 1024,
          }),
        },
      );
      const json = await res.json();
      const message = json?.message || "";
      assert.ok(!message.startsWith("Route "), `Route must exist in Express: ${message}`);
    });
  });

  describe("3. Task Submission Video and Attachment Routes", () => {
    it("should accept GET /task-submissions/upload-url (legacy)", async () => {
      const res = await fetch(
        `${baseUrl}/task-submissions/upload-url?fileName=sub.zip&mimeType=application%2Fzip`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
    });

    it("should accept GET /task-submissions/:id/video/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/task-submissions/${mockSubId}/video/upload-url?mimeType=video%2Fmp4`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should route POST /task-submissions/:id/video/confirm without route 404", async () => {
      const res = await fetch(
        `${baseUrl}/task-submissions/${mockSubId}/video/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath: "submissions/sub-1/video.mp4",
          }),
        },
      );
      const json = await res.json();
      const message = json?.message || "";
      assert.ok(!message.startsWith("Route "), `Route must exist in Express: ${message}`);
    });

    it("should accept GET /task-submissions/:id/attachments/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/task-submissions/${mockSubId}/attachments/upload-url?fileName=demo.pdf&mimeType=application%2Fpdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should route POST /task-submissions/:id/attachments/confirm without route 404", async () => {
      const res = await fetch(
        `${baseUrl}/task-submissions/${mockSubId}/attachments/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath: "submissions/sub-1/demo.pdf",
            fileName: "demo.pdf",
            mimeType: "application/pdf",
            fileSize: 2048,
          }),
        },
      );
      const json = await res.json();
      const message = json?.message || "";
      assert.ok(!message.startsWith("Route "), `Route must exist in Express: ${message}`);
    });
  });

  describe("4. Daily Report Upload Routes", () => {
    it("should accept GET /daily-reports/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/daily-reports/upload-url?fileName=report.pdf&mimeType=application%2Fpdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should accept POST /daily-reports/upload-url", async () => {
      const res = await fetch(`${baseUrl}/daily-reports/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "report.pdf",
          mimeType: "application/pdf",
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
    });

    it("should accept GET /daily-reports/:id/video/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/daily-reports/${mockReportId}/video/upload-url?mimeType=video%2Fmp4`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should route POST /daily-reports/:id/video/confirm without route 404", async () => {
      const res = await fetch(
        `${baseUrl}/daily-reports/${mockReportId}/video/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath: "reports/rep-1/video.mp4",
          }),
        },
      );
      const json = await res.json();
      const message = json?.message || "";
      assert.ok(!message.startsWith("Route "), `Route must exist in Express: ${message}`);
    });

    it("should accept GET /daily-reports/:id/attachments/upload-url", async () => {
      const res = await fetch(
        `${baseUrl}/daily-reports/${mockReportId}/attachments/upload-url?fileName=att.pdf&mimeType=application%2Fpdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });

    it("should route POST /daily-reports/:id/attachments/confirm without route 404", async () => {
      const res = await fetch(
        `${baseUrl}/daily-reports/${mockReportId}/attachments/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath: "reports/rep-1/att.pdf",
            fileName: "att.pdf",
            mimeType: "application/pdf",
            fileSize: 4096,
          }),
        },
      );
      const json = await res.json();
      const message = json?.message || "";
      assert.ok(!message.startsWith("Route "), `Route must exist in Express: ${message}`);
    });
  });

  describe("5. Application Attachment Upload Route", () => {
    it("should accept GET /applications/attachments/upload-url with valid token", async () => {
      const res = await fetch(
        `${baseUrl}/applications/attachments/upload-url?token=mock-token&fileName=cv.pdf&contentType=application%2Fpdf`,
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.uploadUrl);
      assert.ok(json.data.filePath);
      assert.ok(json.data.key);
    });
  });
});
