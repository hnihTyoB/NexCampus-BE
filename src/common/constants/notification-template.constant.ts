export interface TemplateDefault {
  titleTemplate: string;
  contentTemplate: string;
  emailSubjectTemplate: string | null;
  emailContentTemplate: string | null;
}

export const TEMPLATE_DEFAULTS: Record<string, TemplateDefault> = {
  TASK_ASSIGNMENT: {
    titleTemplate: "Bạn đã được giao công việc mới",
    contentTemplate: 'Công việc: "{{taskTitle}}". Hạn nộp: {{deadline}}',
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  TASK_SUBMISSION: {
    titleTemplate: "Bản nộp bài mới cần duyệt",
    contentTemplate:
      'Thực tập sinh {{internName}} đã nộp bài cho công việc "{{taskTitle}}" (Lần {{attempt}}).',
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  SUBMISSION_REVIEW: {
    titleTemplate: "Kết quả duyệt bài nộp",
    contentTemplate:
      'Bài nộp cho công việc "{{taskTitle}}" (Lần {{attempt}}) đã được duyệt: {{reviewStatus}}.',
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  DAILY_REPORT: {
    titleTemplate: "Báo cáo hàng ngày mới",
    contentTemplate: "Thực tập sinh {{internName}} đã gửi báo cáo hàng ngày.",
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  WEEKLY_EVALUATION: {
    titleTemplate: "Đánh giá hàng tuần mới",
    contentTemplate:
      "Bạn nhận được đánh giá tuần {{week}} với tổng điểm là {{totalScore}}/10.",
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  TASK_REMINDER: {
    titleTemplate: "Nhắc nhở hoàn thành công việc",
    contentTemplate:
      'Công việc "{{taskTitle}}" của bạn có hạn nộp vào lúc {{deadline}}. Vui lòng hoàn thành đúng hạn.',
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  EVALUATION_REMINDER: {
    titleTemplate: "Nhắc nhở đánh giá thực tập sinh",
    contentTemplate:
      'Thực tập sinh {{internName}} chưa có đánh giá cho tuần {{week}}. Vui lòng thực hiện đánh giá.',
    emailSubjectTemplate: null,
    emailContentTemplate: null,
  },
  APPLICATION_INVITE: {
    titleTemplate: "[NexCampus] Thư mời nộp đơn đăng ký thực tập",
    contentTemplate:
      'Chào bạn,<br/><br/>Bạn đã nhận được lời mời tham gia ứng tuyển thực tập tại NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để điền thông tin đơn ứng tuyển (liên kết này chỉ có giá trị sử dụng một lần và hết hạn sau 24 giờ):<br/><p style="margin: 16px 0;"><a href="{{applyUrl}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Nộp đơn ứng tuyển</a></p>Hoặc sao chép liên kết này vào trình duyệt của bạn:<br/><a href="{{applyUrl}}">{{applyUrl}}</a><br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    emailSubjectTemplate: "[NexCampus] Thư mời nộp đơn đăng ký thực tập",
    emailContentTemplate:
      'Chào bạn,<br/><br/>Bạn đã nhận được lời mời tham gia ứng tuyển thực tập tại NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để điền thông tin đơn ứng tuyển (liên kết này chỉ có giá trị sử dụng một lần và hết hạn sau 24 giờ):<br/><p style="margin: 16px 0;"><a href="{{applyUrl}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Nộp đơn ứng tuyển</a></p>Hoặc sao chép liên kết này vào trình duyệt của bạn:<br/><a href="{{applyUrl}}">{{applyUrl}}</a><br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
  },
  APPLICATION_APPROVED: {
    titleTemplate: "[NexCampus] Tài khoản thực tập sinh của bạn đã được tạo",
    contentTemplate:
      'Chào mừng bạn đến với NexCampus!<br/><br/>Đơn đăng ký thực tập của bạn tại NexCampus đã được phê duyệt.<br/>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    emailSubjectTemplate: "[NexCampus] Tài khoản thực tập sinh của bạn đã được tạo",
    emailContentTemplate:
      'Chào mừng bạn đến với NexCampus!<br/><br/>Đơn đăng ký thực tập của bạn tại NexCampus đã được phê duyệt.<br/>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
  },
  APPLICATION_REJECTED: {
    titleTemplate: "[NexCampus] Kết quả đăng ký thực tập tại NexCampus",
    contentTemplate:
      'Chào bạn,<br/><br/>Cảm ơn bạn đã quan tâm và nộp đơn đăng ký thực tập tại NexCampus.<br/>Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa phù hợp với các tiêu chí tuyển chọn hiện tại của chúng tôi.<br/>Thông tin chi tiết về đơn đăng ký của bạn:<br/><ul><li><strong>Họ và tên:</strong> {{fullName}}</li><li><strong>Vị trí ứng tuyển:</strong> {{position}}</li><li><strong>Phòng ban:</strong> {{department}}</li></ul>Chúng tôi rất hy vọng sẽ có cơ hội được hợp tác với bạn trong các chương trình tiếp theo. Chúc bạn luôn nhiều sức khỏe và thành công trên con đường sự nghiệp sắp tới.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    emailSubjectTemplate: "[NexCampus] Kết quả đăng ký thực tập tại NexCampus",
    emailContentTemplate:
      'Chào bạn,<br/><br/>Cảm ơn bạn đã quan tâm và nộp đơn đăng ký thực tập tại NexCampus.<br/>Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa phù hợp với các tiêu chí tuyển chọn hiện tại của chúng tôi.<br/>Thông tin chi tiết về đơn đăng ký của bạn:<br/><ul><li><strong>Họ và tên:</strong> {{fullName}}</li><li><strong>Vị trí ứng tuyển:</strong> {{position}}</li><li><strong>Phòng ban:</strong> {{department}}</li></ul>Chúng tôi rất hy vọng sẽ có cơ hội được hợp tác với bạn trong các chương trình tiếp theo. Chúc bạn luôn nhiều sức khỏe và thành công trên con đường sự nghiệp sắp tới.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
  },
  USER_CREATED: {
    titleTemplate: "[NexCampus] Tài khoản của bạn đã được tạo",
    contentTemplate:
      'Chào mừng bạn đến với NexCampus!<br/><br/>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    emailSubjectTemplate: "[NexCampus] Tài khoản của bạn đã được tạo",
    emailContentTemplate:
      'Chào mừng bạn đến với NexCampus!<br/><br/>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
  },
  PASSWORD_RESET: {
    titleTemplate: "[NexCampus] Khôi phục mật khẩu",
    contentTemplate:
      'Bạn đã yêu cầu khôi phục mật khẩu tài khoản NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu mới (liên kết có hiệu lực trong 1 giờ):<br/><p style="margin: 16px 0;"><a href="{{resetLink}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Đặt lại mật khẩu</a></p>Hoặc sao chép liên kết này vào trình duyệt:<br/><a href="{{resetLink}}">{{resetLink}}</a>',
    emailSubjectTemplate: "[NexCampus] Khôi phục mật khẩu",
    emailContentTemplate:
      'Bạn đã yêu cầu khôi phục mật khẩu tài khoản NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu mới (liên kết có hiệu lực trong 1 giờ):<br/><p style="margin: 16px 0;"><a href="{{resetLink}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Đặt lại mật khẩu</a></p>Hoặc sao chép liên kết này vào trình duyệt:<br/><a href="{{resetLink}}">{{resetLink}}</a>',
  },
};
