import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplateString } from '../src/common/helpers/template.helper';
import { EmailTemplateService } from '../src/common/services/email-template.service';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  previewNotificationTemplateSchema,
} from '../src/modules/notification/notification.validation';

describe('Notification Template Rendering & Helpers', () => {
  it('should interpolate placeholders correctly in renderTemplateString', () => {
    const template = 'Xin chào {{fullName}}, mã xác thực của bạn là: {{code}}!';
    const result = renderTemplateString(template, {
      fullName: 'Nguyễn Văn A',
      code: '889900',
    });

    assert.equal(result, 'Xin chào Nguyễn Văn A, mã xác thực của bạn là: 889900!');
  });

  it('should handle placeholders with surrounding whitespaces inside braces', () => {
    const template = 'Chào {{  name  }}, số dư của bạn là {{ balance }} đ.';
    const result = renderTemplateString(template, {
      name: 'Tester',
      balance: 500000,
    });

    assert.equal(result, 'Chào Tester, số dư của bạn là 500000 đ.');
  });

  it('should replace undefined/null variables with empty string gracefully', () => {
    const template = 'Hello {{firstName}} {{lastName}}!';
    const result = renderTemplateString(template, {
      firstName: 'John',
      lastName: null,
    });

    assert.equal(result, 'Hello John !');
  });

  it('should return empty string when empty template is provided', () => {
    assert.equal(renderTemplateString(''), '');
  });
});

describe('Email Template Service Standards', () => {
  const service = new EmailTemplateService();

  it('should wrap body HTML with responsive base layout', () => {
    const layout = service.baseLayout('Tiêu đề kiểm tra', '<p>Nội dung kiểm tra</p>');
    assert.match(layout, /<h2.*>Tiêu đề kiểm tra<\/h2>/);
    assert.match(layout, /<p>Nội dung kiểm tra<\/p>/);
    assert.match(layout, /max-width: 600px/);
  });

  it('should synchronously render VERIFY_EMAIL template', () => {
    const result = service.render('VERIFY_EMAIL', {
      token: 'test-uuid-token',
      fullName: 'Nguyễn Văn B',
    });

    assert.equal(result.subject, 'Xác thực tài khoản của bạn');
    assert.match(result.html, /Nguyễn Văn B/);
    assert.match(result.html, /test-uuid-token/);
  });
});

describe('Notification Template Zod Validation', () => {
  it('should validate valid create template input', () => {
    const valid = createNotificationTemplateSchema.safeParse({
      code: 'PAYMENT_SUCCESS',
      name: 'Thanh toán thành công',
      description: 'Gửi khi đơn hàng thanh toán thành công',
      channels: ['WEB', 'EMAIL'],
      subject: 'Xác nhận thanh toán đơn hàng {{orderId}}',
      title: 'Thanh toán thành công',
      content: 'Đơn hàng {{orderId}} trị giá {{amount}} đã thanh toán.',
      variables: ['orderId', 'amount'],
      isActive: true,
    });

    assert.equal(valid.success, true);
  });

  it('should reject invalid template code format (lowercase or invalid characters)', () => {
    const invalid = createNotificationTemplateSchema.safeParse({
      code: 'payment-success!',
      name: 'Thanh toán',
      channels: ['WEB'],
      content: 'Nội dung',
    });

    assert.equal(invalid.success, false);
  });

  it('should validate preview template schema', () => {
    const parsed = previewNotificationTemplateSchema.safeParse({
      variables: {
        orderId: 'ORD-12345',
        amount: 250000,
      },
    });

    assert.equal(parsed.success, true);
  });
});
