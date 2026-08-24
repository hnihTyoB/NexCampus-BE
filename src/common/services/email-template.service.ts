import { mailConfig } from '../../config/mail.config';
import { notificationRepository } from '../../modules/notification/notification.repository';
import { EMAIL_TEMPLATE_KEY, EmailTemplateKey } from '../constants/notification.constant';
import { renderTemplateString } from '../helpers/template.helper';
import { formatVietnamDateTime } from '../helpers/date.helper';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export class EmailTemplateService {
  private readonly appUrl: string;

  constructor() {
    this.appUrl = mailConfig.verificationUrl.replace('/api/v1/auth/verify-email', '');
  }

  /**
   * Render nội dung email: Ưu tiên lấy mẫu tùy biến từ Database theo templateKey/code,
   * nếu không tìm thấy sẽ tự động fallback về layout mã nguồn mặc định.
   */
  async renderAsync(templateKey: string, data: Record<string, unknown>): Promise<EmailTemplate> {
    try {
      const dbTemplate = await notificationRepository.findTemplateByCode(templateKey);

      if (dbTemplate && dbTemplate.isActive) {
        const subject = renderTemplateString(dbTemplate.subject || 'Thông báo từ hệ thống', data);
        const bodyContent = renderTemplateString(dbTemplate.content, data);
        const html = this.baseLayout(dbTemplate.title || subject, bodyContent);
        return { subject, html };
      }
    } catch (error) {
      console.warn(`[EmailTemplateService] Database template fetch failed for '${templateKey}', falling back to built-in layout:`, error);
    }

    return this.render(templateKey as EmailTemplateKey, data);
  }

  /**
   * Fallback render đồng bộ cho các template cốt lõi.
   */
  render(templateKey: EmailTemplateKey, data: Record<string, unknown>): EmailTemplate {
    switch (templateKey) {
      case EMAIL_TEMPLATE_KEY.VERIFY_EMAIL:
        return this.verifyEmail(data);
      case EMAIL_TEMPLATE_KEY.RESET_PASSWORD:
        return this.resetPassword(data);
      case EMAIL_TEMPLATE_KEY.NEW_DEVICE_ALERT:
        return this.newDeviceAlert(data);
      case EMAIL_TEMPLATE_KEY.ACTIVITY_SUMMARY_DIGEST:
        return this.activitySummaryDigest(data);
      case EMAIL_TEMPLATE_KEY.CUSTOM:
        return this.custom(data);

      default:
        return {
          subject: (data['subject'] as string) || 'Thông báo từ hệ thống',
          html: this.baseLayout((data['title'] as string) || 'Thông báo', renderTemplateString((data['content'] as string) || '', data)),
        };
    }
  }

  baseLayout(title: string, bodyHtml: string): string {
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
          <tr><td style="padding: 8px; color: #666;">Thời gian:</td><td style="padding: 8px; font-weight: bold;">${time || formatVietnamDateTime(new Date())}</td></tr>
        </table>

        <p>Nếu đây không phải bạn, hãy đổi mật khẩu ngay lập tức.</p>
      `),
    };
  }

  private activitySummaryDigest(data: Record<string, unknown>): EmailTemplate {
    const period = (data['period'] as string) || 'Hàng ngày';
    const startDate = (data['startDate'] as string) || '';
    const endDate = (data['endDate'] as string) || '';
    const newUsersCount = Number(data['newUsersCount'] || 0);
    const activeSessionsCount = Number(data['activeSessionsCount'] || 0);
    const notificationsSentCount = Number(data['notificationsSentCount'] || 0);
    const emailsSentCount = Number(data['emailsSentCount'] || 0);
    const webhookDeliveriesCount = Number(data['webhookDeliveriesCount'] || 0);
    const auditLogsCount = Number(data['auditLogsCount'] || 0);

    const subject = `[Báo cáo ${period}] Tổng kết hoạt động hệ thống (${startDate} - ${endDate})`;

    const html = this.baseLayout(`📊 Báo cáo Tổng kết Hoạt động (${period})`, `
      <p style="color: #444; font-size: 14px;">Kính gửi Quản trị viên,</p>
      <p style="color: #444; font-size: 14px;">Dưới đây là số liệu tổng hợp hoạt động của hệ thống trong khoảng thời gian từ <strong>${startDate}</strong> đến <strong>${endDate}</strong>:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9f9fb; border-radius: 6px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">👤 Người dùng đăng ký mới:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${newUsersCount.toLocaleString('vi-VN')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">🔑 Phiên đăng nhập / Tokens:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${activeSessionsCount.toLocaleString('vi-VN')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">🔔 Thông báo In-App tạo mới:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${notificationsSentCount.toLocaleString('vi-VN')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">📧 Email đã gửi thành công:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${emailsSentCount.toLocaleString('vi-VN')}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">🚀 Webhook Deliveries:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${webhookDeliveriesCount.toLocaleString('vi-VN')}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #4b5563; font-weight: 500;">🛡️ Hành động Audit Logs ghi nhận:</td>
          <td style="padding: 12px 16px; font-weight: bold; color: #111827; text-align: right;">${auditLogsCount.toLocaleString('vi-VN')}</td>
        </tr>
      </table>

      <p style="color: #6b7280; font-size: 13px;">Báo cáo được sinh tự động bởi Cron Scheduler Engine vào lúc ${formatVietnamDateTime(new Date())}.</p>
    `);


    return { subject, html };
  }

  private custom(data: Record<string, unknown>): EmailTemplate {
    const { subject, html } = data as { subject: string; html: string };
    return { subject, html };
  }
}

