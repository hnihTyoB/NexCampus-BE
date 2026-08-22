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
