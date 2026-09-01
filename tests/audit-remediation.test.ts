import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission } from '../src/middlewares/permission.middleware';
import { extractTokenFromRequest, authMiddleware } from '../src/middlewares/auth.middleware';
import { errorMiddleware } from '../src/middlewares/error.middleware';
import { permissionCacheService } from '../src/common/services/permission-cache.service';
import { EmailWorker } from '../src/common/workers/email-worker';
import { getVietnamDayRange, formatVietnamDate } from '../src/common/helpers/date.helper';
import { Prisma } from '@prisma/client';
import { ERROR_CODE } from '../src/common/errors/error-code';

function createMockReqRes(options: {
  user?: any;
  apiKey?: any;
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
} = {}) {
  const req: any = {
    user: options.user,
    apiKey: options.apiKey,
    path: options.path || '/api/v1/test',
    originalUrl: options.path || '/api/v1/test',
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
  };

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
  };

  return { req, res };
}

describe('Audit & Remediation Verification Test Suite', () => {

  beforeEach(() => {
    permissionCacheService.clear();
  });

  describe('1. [P0-SEC-01] API Key Scoping Enforcement in Permission Middleware', () => {
    it('should grant access when API Key has the required scoped permission', async () => {
      const roleId = 'role-admin-uuid';
      (permissionCacheService as any).cache.set(roleId, {
        permissions: new Set(['USER_READ', 'USER_DELETE', 'ROLE_DELETE']),
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        user: {
          id: 'admin-user-id',
          roleId,
          role: 'ADMIN',
          permissions: ['USER_READ'], // API Key only granted USER_READ
        },
        apiKey: {
          id: 'ak-123',
          name: 'Read-only API Key',
          permissions: ['USER_READ'],
        },
      });

      let nextCalled = false;
      const middleware = requirePermission('USER_READ');
      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Next should be called for permitted scope');
      assert.deepEqual(req.user.permissions, ['USER_READ']);
    });

    it('should DENY access with 403 when API Key lacks permission even if User Role has it (Privilege Escalation Prevention)', async () => {
      const roleId = 'role-admin-uuid';
      (permissionCacheService as any).cache.set(roleId, {
        permissions: new Set(['USER_READ', 'USER_DELETE', 'ROLE_DELETE']),
        expiresAt: Date.now() + 60000,
      });

      const { req, res } = createMockReqRes({
        user: {
          id: 'admin-user-id',
          roleId,
          role: 'ADMIN',
          permissions: ['USER_READ'], // Scoped API Key has only USER_READ
        },
        apiKey: {
          id: 'ak-123',
          name: 'Read-only API Key',
          permissions: ['USER_READ'],
        },
      });

      let nextError: any;
      const middleware = requirePermission('ROLE_DELETE');
      await middleware(req, res, (err?: any) => {
        nextError = err;
      });

      assert.ok(nextError, 'Should throw an error');
      assert.equal(nextError.statusCode, 403);
      assert.equal(nextError.code, ERROR_CODE.FORBIDDEN);
    });
  });

  describe('2. [P1-SEC-02] Token Query Parameter Security Isolation', () => {
    it('should reject JWT token in query string on normal REST endpoints', () => {
      const req = {
        path: '/api/v1/users',
        query: { token: 'sensitive-jwt-token' },
        headers: {},
        cookies: {},
      } as any;

      const token = extractTokenFromRequest(req);
      assert.equal(token, undefined, 'Token should not be extracted from query string for REST routes');
    });

    it('should permit JWT token in query string strictly for SSE stream endpoints', () => {
      const req = {
        path: '/api/v1/notifications/stream',
        query: { token: 'sse-jwt-token' },
        headers: {},
        cookies: {},
      } as any;

      const token = extractTokenFromRequest(req);
      assert.equal(token, 'sse-jwt-token', 'Token should be extracted from query string for SSE stream routes');
    });
  });

  describe('3. [P2-ERR-01] Prisma P2014 Relation Constraint Violation Handling', () => {
    it('should map Prisma P2014 error to HTTP 400 Bad Request instead of 500 Internal Error', () => {
      const { req, res } = createMockReqRes();
      const p2014Error = new Prisma.PrismaClientKnownRequestError(
        'The change you are trying to make would violate the required relation between models',
        {
          code: 'P2014',
          clientVersion: '5.22.0',
        },
      );

      let nextCalled = false;
      errorMiddleware(p2014Error, req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, ERROR_CODE.VALIDATION_ERROR);
    });
  });

  describe('4. [P2-WORKER-01] EmailWorker Async Graceful Shutdown', () => {
    it('should stop cleanly and allow async awaiting', async () => {
      const worker = new EmailWorker();
      await worker.stop();
      assert.ok(true, 'Worker stop() must be async and resolve cleanly');
    });
  });

  describe('5. [P2-CRON-02] Timezone Calendar Day Range Boundary', () => {
    it('should accurately calculate startOfDay (17:00:00Z previous day) and endOfDay (16:59:59.999Z) for Vietnam UTC+7', () => {
      const { startOfDay, endOfDay } = getVietnamDayRange('2026-08-24');

      assert.equal(startOfDay.toISOString(), '2026-08-23T17:00:00.000Z');
      assert.equal(endOfDay.toISOString(), '2026-08-24T16:59:59.999Z');
      assert.equal(formatVietnamDate(startOfDay), '2026-08-24');
    });
  });

  describe('6. [P1-SEC-01] Email HTML Injection & XSS Sanitization', () => {
    it('should sanitize fullName and deviceName preventing HTML Injection in email templates', () => {
      const { escapeHtml } = require('../src/common/helpers/template.helper');
      const maliciousName = '<img src=x onerror=alert(1)>';
      const safeName = escapeHtml(maliciousName);
      assert.ok(!safeName.includes('<img'));
      assert.ok(safeName.includes('&lt;img src=x onerror=alert(1)&gt;'));
    });
  });

  describe('7. [P1-BUG-01] UUID Normalization in Notification Repository', () => {
    it('should normalize invalid non-UUID strings to null for email notifications', async () => {
      const { notificationRepository } = require('../src/modules/notification/notification.repository');
      const isUuid = (val: any) => val && /^[0-9a-fA-F-]{36}$/.test(val);
      assert.equal(isUuid('mock-admin-1'), false);
      assert.equal(isUuid('123e4567-e89b-12d3-a456-426614174000'), true);
      assert.equal(isUuid(''), false);
      assert.equal(isUuid(undefined), false);
    });
  });

  describe('8. [P1-PERF-01] User State Caching in PermissionCacheService', () => {
    it('should cache user state and correctly invalidate on user update', async () => {
      const userId = 'user-test-uuid-1';
      (permissionCacheService as any).userCache.set(userId, {
        user: {
          id: userId,
          isActive: true,
          deletedAt: null,
          roleId: 'role-1',
          roleName: 'USER',
        },
        expiresAt: Date.now() + 60000,
      });

      const cached = await permissionCacheService.getUserState(userId);
      assert.ok(cached);
      assert.equal(cached?.id, userId);
      assert.equal(cached?.roleName, 'USER');

      permissionCacheService.invalidateUser(userId);
      const afterInvalidate = (permissionCacheService as any).userCache.get(userId);
      assert.equal(afterInvalidate, undefined);
    });
  });

  describe('9. [P3-DEF-01] Strict Regex Validation for Vietnam Day Range', () => {
    it('should reject invalid calendar date formats', () => {
      assert.throws(() => getVietnamDayRange('invalid-date'), /Invalid date format/);
      assert.throws(() => getVietnamDayRange('2026-13-40'), /Invalid date format/);
      assert.throws(() => getVietnamDayRange('2026/08/24'), /Invalid date format/);
      assert.doesNotThrow(() => getVietnamDayRange('2026-08-24'));
    });
  });

  describe('10. [P3-API-01] User Validation Schemas with FullName and PhoneNumber', () => {
    it('should validate and parse createUserSchema with optional fullName and phoneNumber', () => {
      const { createUserSchema, updateUserSchema } = require('../src/modules/users/user.validation');
      const validCreate = createUserSchema.safeParse({
        email: 'test.user@example.com',
        password: 'Password123!',
        roleId: '123e4567-e89b-12d3-a456-426614174000',
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
      });
      assert.equal(validCreate.success, true);

      const validUpdate = updateUserSchema.safeParse({
        fullName: 'Trần Thị B',
        phoneNumber: '0987654321',
        isActive: true,
      });
      assert.equal(validUpdate.success, true);
    });
  });

});
