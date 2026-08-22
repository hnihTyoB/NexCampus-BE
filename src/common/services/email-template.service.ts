import { mailConfig } from '../../config/mail.config';
import { EMAIL_TEMPLATE_KEY, EmailTemplateKey } from '../constants/notification.constant';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export class EmailTemplateService {
  private readonly appUrl: string;

  constructor() {
    this.appUrl = mailConfig.verificationUrl.replace('/api/v1/auth/verify-email', '');
  }

  render(templateKey: EmailTemplateKey, data: Record<string, unknown>): EmailTemplate {
    switch (templateKey) {
      case EMAIL_TEMPLATE_KEY.VERIFY_EMAIL:
        return this.verifyEmail(data);
      case EMAIL_TEMPLATE_KEY.RESET_PASSWORD:
        return this.resetPassword(data);
      case EMAIL_TEMPLATE_KEY.NEW_DEVICE_ALERT:
        return this.newDeviceAlert(data);
      case EMAIL_TEMPLATE_KEY.CUSTOM:
        return this.custom(data);
      default:
        throw new Error(`Unknown email template key: ${templateKey}`);
    }
  }

  private baseLayout(title: string, bodyHtml: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #4CAF50; text-align: center; margin-bottom: 24px;">${title}</h2>
        ${bodyHtml}
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          Đây là email tự động, vui lòng không trả lời.<br/>
          © ${new Date().getFullYear()} Hệ thống quản lý
        </p>
      </div>
    `;
  }

  private verifyEmail(data: Record<string, unknown>): EmailTemplate {
    const { token, fullName } = data as { token: string; fullName?: string };
    const verificationUrl = `${mailConfig.verificationUrl}?token=${token}`;
    return {
      subject: 'Xác thực tài khoản của bạn',
      html: this.baseLayout('Xác thực tài khoản', `
        <p>Chào ${fullName || 'bạn'},</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào nút bên dưới để xác thực email:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}"
             style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
            Xác thực tài khoản
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">Link có hiệu lực trong 24 giờ.<br/>
        Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
      `),
    };
  }

  private resetPassword(data: Record<string, unknown>): EmailTemplate {
    const { resetUrl, fullName } = data as { resetUrl: string; fullName?: string };
    return {
      subject: 'Đặt lại mật khẩu',
      html: this.baseLayout('Đặt lại mật khẩu', `
        <p>Chào ${fullName || 'bạn'},</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #FF5722; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">Link có hiệu lực trong 1 giờ.<br/>
        Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này và đổi mật khẩu ngay lập tức nếu cần.</p>
      `),
    };
  }

  private newDeviceAlert(data: Record<string, unknown>): EmailTemplate {
    const { deviceName, ipAddress, time, fullName } = data as {
      deviceName?: string;
      ipAddress?: string;
      time?: string;
      fullName?: string;
    };
    return {
      subject: 'Phát hiện đăng nhập từ thiết bị mới',
      html: this.baseLayout('⚠️ Cảnh báo bảo mật', `
        <p>Chào ${fullName || 'bạn'},</p>
        <p>Tài khoản của bạn vừa được đăng nhập từ thiết bị mới:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666; width: 140px;">Thiết bị:</td><td style="padding: 8px; font-weight: bold;">${deviceName || 'Không xác định'}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Địa chỉ IP:</td><td style="padding: 8px; font-weight: bold;">${ipAddress || 'Không xác định'}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Thời gian:</td><td style="padding: 8px; font-weight: bold;">${time || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td></tr>
        </table>
        <p>Nếu đây không phải bạn, hãy đổi mật khẩu ngay lập tức.</p>
      `),
    };
  }

  private custom(data: Record<string, unknown>): EmailTemplate {
    const { subject, html } = data as { subject: string; html: string };
    return { subject, html };
  }
}
