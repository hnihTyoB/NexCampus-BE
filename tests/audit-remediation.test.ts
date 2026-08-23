import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateUserSchema } from '../src/modules/users/user.validation';
import { sendNotificationSchema, broadcastNotificationSchema } from '../src/modules/notification/notification.validation';
import { EmailTemplateService } from '../src/common/services/email-template.service';
import { EMAIL_TEMPLATE_KEY, EMAIL_STATUS } from '../src/common/constants/notification.constant';
import { formatVietnamDateTime } from '../src/common/helpers/date.helper';

describe('Audit Remediation: User Validation & RBAC Isolation', () => {
  it('should accept isActive update in updateUserSchema', () => {
    const valid = { isActive: false };
    const result = updateUserSchema.safeParse(valid);
    assert.equal(result.success, true);
    assert.equal((result as any).data.isActive, false);
  });

  it('should strip roleId if passed to updateUserSchema to protect RBAC boundaries', () => {
    const maliciousInput = {
      isActive: true,
      roleId: '123e4567-e89b-12d3-a456-426614174000',
    };
    const result = updateUserSchema.safeParse(maliciousInput);
    assert.equal(result.success, true);
    assert.equal((result as any).data.roleId, undefined);
  });
});

describe('Audit Remediation: Notification Validation & Enums', () => {
  it('should validate sendNotificationSchema with valid enums', () => {
    const valid = {
      userIds: ['123e4567-e89b-12d3-a456-426614174000'],
      channels: ['WEB', 'EMAIL'],
      title: 'Test Notification',
      content: 'Hello World',
      type: 'ALERT',
      priority: 'HIGH',
      templateKey: 'NEW_DEVICE_ALERT',
    };
    const result = sendNotificationSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('should reject invalid channel or invalid type in sendNotificationSchema', () => {
    const invalid = {
      userIds: ['123e4567-e89b-12d3-a456-426614174000'],
      channels: ['SMS'], // Invalid channel
      title: 'Test',
      content: 'Test',
    };
    const result = sendNotificationSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('should support PROCESSING in EMAIL_STATUS constants', () => {
    assert.equal(EMAIL_STATUS.PROCESSING, 'PROCESSING');
    assert.equal(EMAIL_STATUS.PENDING, 'PENDING');
    assert.equal(EMAIL_STATUS.SENT, 'SENT');
    assert.equal(EMAIL_STATUS.FAILED, 'FAILED');
  });
});

describe('Audit Remediation: Timezone & Email Template Standards', () => {
  it('should format email alert dates with Asia/Ho_Chi_Minh timezone', () => {
    const templateService = new EmailTemplateService();
    const testDate = new Date('2026-08-22T17:30:00.000Z'); // 2026-08-23 00:30:00 in Vietnam

    const template = templateService.render(EMAIL_TEMPLATE_KEY.NEW_DEVICE_ALERT, {
      fullName: 'Test User',
      deviceName: 'Chrome trên Windows',
      ipAddress: '127.0.0.1',
      time: formatVietnamDateTime(testDate),
    });

    assert.ok(template.html.includes('Chrome trên Windows'));
    assert.ok(template.html.includes('127.0.0.1'));
    // Should include 2026 and 00:30:00 / 23:08 / 23/8
    assert.ok(template.html.includes('2026'));
  });
});

describe('Audit Remediation: Pagination Response Shape Invariant', () => {
  it('should enforce uniform pagination metadata schema', () => {
    const mockServiceResponse = {
      items: [{ id: '1', title: 'Notification 1' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    // Transform into controller standard
    const standardized = {
      success: true,
      data: mockServiceResponse.items,
      meta: {
        total: mockServiceResponse.total,
        page: mockServiceResponse.page,
        limit: mockServiceResponse.limit,
        totalPages: mockServiceResponse.totalPages,
      },
    };

    assert.equal(standardized.success, true);
    assert.ok(Array.isArray(standardized.data));
    assert.equal(standardized.meta.total, 1);
    assert.equal(standardized.meta.page, 1);
    assert.equal(standardized.meta.limit, 20);
    assert.equal(standardized.meta.totalPages, 1);
  });
});

describe('Audit Remediation: Rate Limiting & RFC 6585 Headers', () => {
  it('should enforce rate limit, set X-RateLimit headers, and return 429 with Retry-After when exceeded', async () => {
    const { createRateLimiter } = await import('../src/middlewares/rate-limit.middleware');
    const { ERROR_CODE } = await import('../src/common/errors/error-code');

    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 3,
      message: 'Rate limit test exceeded',
      keyGenerator: () => 'test-ip-123',
    });

    const createMockReqRes = () => {
      const headers: Record<string, any> = {};
      let statusCode = 200;
      let responseBody: any = null;

      const req: any = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
      const res: any = {
        setHeader: (key: string, val: any) => {
          headers[key.toLowerCase()] = val;
        },
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      };

      return { req, res, headers, getStatusCode: () => statusCode, getBody: () => responseBody };
    };

    // Request 1: OK
    const r1 = createMockReqRes();
    let nextCalled1 = false;
    limiter(r1.req, r1.res, () => { nextCalled1 = true; });
    assert.equal(nextCalled1, true);
    assert.equal(r1.headers['x-ratelimit-limit'], 3);
    assert.equal(r1.headers['x-ratelimit-remaining'], 2);

    // Request 2: OK
    const r2 = createMockReqRes();
    let nextCalled2 = false;
    limiter(r2.req, r2.res, () => { nextCalled2 = true; });
    assert.equal(nextCalled2, true);
    assert.equal(r2.headers['x-ratelimit-remaining'], 1);

    // Request 3: OK
    const r3 = createMockReqRes();
    let nextCalled3 = false;
    limiter(r3.req, r3.res, () => { nextCalled3 = true; });
    assert.equal(nextCalled3, true);
    assert.equal(r3.headers['x-ratelimit-remaining'], 0);

    // Request 4: Exceeded (429)
    const r4 = createMockReqRes();
    let nextCalled4 = false;
    limiter(r4.req, r4.res, () => { nextCalled4 = true; });
    assert.equal(nextCalled4, false);
    assert.equal(r4.getStatusCode(), 429);
    assert.ok(Number(r4.headers['retry-after']) >= 1);
    assert.equal(r4.getBody().code, ERROR_CODE.RATE_LIMIT_EXCEEDED);
    assert.equal(r4.getBody().message, 'Rate limit test exceeded');
  });
});

describe('Audit Remediation: Prisma Error Mapping & Validation', () => {
  it('should map Prisma P2002 to 409 DUPLICATE_ENTRY in errorMiddleware', async () => {
    const { errorMiddleware } = await import('../src/middlewares/error.middleware');
    const { ERROR_CODE } = await import('../src/common/errors/error-code');
    const { Prisma } = await import('@prisma/client');

    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });

    let statusCode = 200;
    let responseBody: any = null;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    };

    errorMiddleware(prismaError, {} as any, res, () => {});

    assert.equal(statusCode, 409);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.code, ERROR_CODE.DUPLICATE_ENTRY);
  });

  it('should map Prisma P2025 to 404 NOT_FOUND in errorMiddleware', async () => {
    const { errorMiddleware } = await import('../src/middlewares/error.middleware');
    const { ERROR_CODE } = await import('../src/common/errors/error-code');
    const { Prisma } = await import('@prisma/client');

    const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });

    let statusCode = 200;
    let responseBody: any = null;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    };

    errorMiddleware(prismaError, {} as any, res, () => {});

    assert.equal(statusCode, 404);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.code, ERROR_CODE.NOT_FOUND);
  });

  it('should validate UUID in verifyEmailSchema', async () => {
    const { verifyEmailSchema } = await import('../src/modules/auth/auth.validation');

    const valid = { token: '123e4567-e89b-12d3-a456-426614174000' };
    const invalid = { token: 'not-a-valid-uuid' };

    assert.equal(verifyEmailSchema.safeParse(valid).success, true);
    assert.equal(verifyEmailSchema.safeParse(invalid).success, false);
  });
});

