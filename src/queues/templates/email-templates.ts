import Handlebars from "handlebars";

export type EmailTemplateType =
  | "INVITE_APPLICATION"
  | "INTERN_ACCOUNT_CREATED"
  | "RESET_PASSWORD"
  | "DAILY_REPORT_REMINDER"
  | "CUSTOM";

export interface RenderedEmail {
  subject: string;
  html: string;
}

const baseLayoutTemplate = Handlebars.compile(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 20px 0; text-align: center; }
    .btn:hover { background-color: #4338ca; }
    .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .info-item { margin: 8px 0; font-size: 14px; }
    .info-label { color: #64748b; font-weight: 500; display: inline-block; width: 140px; }
    .info-value { color: #0f172a; font-weight: 600; }
    .footer { background-color: #f9fafb; padding: 20px 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NexCampus</h1>
    </div>
    <div class="content">
      {{{body}}}
    </div>
    <div class="footer">
      <p style="margin: 4px 0;">Hệ thống quản lý thực tập sinh NexCampus</p>
      <p style="margin: 4px 0; font-size: 12px; color: #9ca3af;">Đây là email tự động, vui lòng không phản hồi trực tiếp thư này.</p>
    </div>
  </div>
</body>
</html>
`);

const inviteApplicationTemplate = Handlebars.compile(`
  <h2 style="color: #111827; margin-top: 0; font-size: 18px;">Thư mời hoàn thiện hồ sơ ứng tuyển</h2>
  <p>Xin chào <strong>{{candidateEmail}}</strong>,</p>
  <p>Bạn nhận được thư mời tham gia chương trình thực tập tại NexCampus. Vui lòng bấm vào liên kết bên dưới để hoàn thiện thông tin ứng tuyển và xác nhận các chính sách thực tập:</p>
  <div style="text-align: center;">
    <a href="{{{applyUrl}}}" class="btn">Hoàn thiện hồ sơ ứng tuyển</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">Hoặc sao chép đường dẫn sau vào trình duyệt:<br/><a href="{{{applyUrl}}}" style="color: #4f46e5; word-break: break-all;">{{{applyUrl}}}</a></p>
  {{#if expiresAt}}
  <p style="font-size: 13px; color: #ef4444;"><strong>Lưu ý:</strong> Liên kết mời này có hiệu lực đến ngày: {{expiresAt}}.</p>
  {{/if}}
`);

const internAccountCreatedTemplate = Handlebars.compile(`
  <h2 style="color: #111827; margin-top: 0; font-size: 18px;">Chúc mừng bạn đã được phê duyệt thực tập!</h2>
  <p>Xin chào <strong>{{fullName}}</strong>,</p>
  <p>Hồ sơ ứng tuyển của bạn đã được Quản trị viên xét duyệt thành công. Tài khoản hệ thống NexCampus của bạn đã được khởi tạo với thông tin chi tiết như sau:</p>
  <div class="info-box">
    <div class="info-item"><span class="info-label">Tài khoản (Email):</span> <span class="info-value">{{email}}</span></div>
    <div class="info-item"><span class="info-label">Mật khẩu tạm thời:</span> <span class="info-value" style="font-family: monospace; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; color: #3730a3;">{{temporaryPassword}}</span></div>
    {{#if departmentName}}
    <div class="info-item"><span class="info-label">Phòng ban:</span> <span class="info-value">{{departmentName}}</span></div>
    {{/if}}
    {{#if positionTitle}}
    <div class="info-item"><span class="info-label">Vị trí:</span> <span class="info-value">{{positionTitle}}</span></div>
    {{/if}}
    {{#if startDate}}
    <div class="info-item"><span class="info-label">Ngày bắt đầu:</span> <span class="info-value">{{startDate}}</span></div>
    {{/if}}
  </div>
  <div style="text-align: center;">
    <a href="{{{loginUrl}}}" class="btn">Đăng nhập hệ thống ngay</a>
  </div>
  <p style="font-size: 13px; color: #ef4444;"><strong>Quan trọng:</strong> Vì lý do bảo mật, vui lòng tiến hành đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>
`);

const resetPasswordTemplate = Handlebars.compile(`
  <h2 style="color: #111827; margin-top: 0; font-size: 18px;">Yêu cầu đặt lại mật khẩu</h2>
  <p>Xin chào <strong>{{fullName}}</strong>,</p>
  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản NexCampus liên kết với email này. Vui lòng bấm nút bên dưới để tiến hành thiết lập mật khẩu mới:</p>
  <div style="text-align: center;">
    <a href="{{{resetUrl}}}" class="btn" style="background-color: #ef4444;">Đặt lại mật khẩu</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">Hoặc sao chép đường dẫn sau vào trình duyệt:<br/><a href="{{{resetUrl}}}" style="color: #ef4444; word-break: break-all;">{{{resetUrl}}}</a></p>
  <p style="font-size: 13px; color: #6b7280;">Liên kết này có hiệu lực trong vòng {{#if expiresIn}}{{expiresIn}}{{else}}1 giờ{{/if}}. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua thư và mật khẩu của bạn vẫn an toàn.</p>
`);

const dailyReportReminderTemplate = Handlebars.compile(`
  <h2 style="color: #111827; margin-top: 0; font-size: 18px;">Nhắc nhở nộp báo cáo tiến độ ngày</h2>
  <p>Xin chào <strong>{{internName}}</strong>,</p>
  <p>Đây là thông báo nhắc nhở nộp báo cáo công việc ngày <strong>{{reportDate}}</strong> của bạn trên hệ thống NexCampus.</p>
  <p>Đừng quên cập nhật những công việc đã hoàn thành, các vấn đề gặp phải (blockers) và kế hoạch ngày làm việc tiếp theo nhé!</p>
  <div style="text-align: center;">
    <a href="{{{submitUrl}}}" class="btn">Nộp báo cáo ngay</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">Nộp báo cáo đầy đủ và đúng hạn giúp Leader theo dõi sát tiến độ và hỗ trợ bạn kịp thời.</p>
`);

const customTemplate = Handlebars.compile(`
  <h2 style="color: #111827; margin-top: 0; font-size: 18px;">{{title}}</h2>
  <div>{{{content}}}</div>
`);

export function renderEmailTemplate(
  type: EmailTemplateType,
  data: Record<string, unknown>,
): RenderedEmail {
  let subject = "";
  let bodyHtml = "";

  switch (type) {
    case "INVITE_APPLICATION": {
      subject =
        (data.subject as string) ||
        "[NexCampus] Thư mời ứng tuyển và hoàn thiện hồ sơ thực tập";
      bodyHtml = inviteApplicationTemplate(data);
      break;
    }
    case "INTERN_ACCOUNT_CREATED": {
      subject =
        (data.subject as string) ||
        "[NexCampus] Chúc mừng bạn đã được phê duyệt thực tập — Thông tin tài khoản";
      bodyHtml = internAccountCreatedTemplate(data);
      break;
    }
    case "RESET_PASSWORD": {
      subject =
        (data.subject as string) ||
        "[NexCampus] Yêu cầu đặt lại mật khẩu tài khoản";
      bodyHtml = resetPasswordTemplate(data);
      break;
    }
    case "DAILY_REPORT_REMINDER": {
      subject =
        (data.subject as string) ||
        `[NexCampus] Nhắc nhở nộp báo cáo tiến độ ngày ${data.reportDate || ""}`;
      bodyHtml = dailyReportReminderTemplate(data);
      break;
    }
    case "CUSTOM":
    default: {
      subject = (data.subject as string) || "Thông báo từ NexCampus";
      bodyHtml = customTemplate({
        title: (data.title as string) || subject,
        content: (data.content as string) || "",
      });
      break;
    }
  }

  const fullHtml = baseLayoutTemplate({
    title: subject,
    body: bodyHtml,
  });

  return {
    subject,
    html: fullHtml,
  };
}
