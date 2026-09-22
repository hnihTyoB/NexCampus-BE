import { PrismaClient } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedSystem(
  prisma: PrismaClient,
  adminId: string,
  leaders: Record<string, string>,
  internUsers: Record<string, string>,
  interns: Record<string, string>
): Promise<{ regulationId: string }> {
  console.log("\n[Cấu hình] Khởi tạo Cấu hình hệ thống, Nội quy, Mẫu thông báo & Nhật ký...");

  // 1. System Settings
  const systemSettings = [
    { key: "DAILY_REPORT_DEADLINE_TIME", value: "17:30", description: "Thời gian chốt nộp báo cáo ngày hằng ngày" },
    { key: "WORKING_DAYS_PER_WEEK", value: "6", description: "Số ngày làm việc chính thức trong tuần (Thứ 2 đến Thứ 7)" },
    { key: "MAX_ACTIVE_TASKS", value: "3", description: "Số lượng công việc đang xử lý tối đa của một thực tập sinh" },
    { key: "MAX_WORKLOAD_DAYS", value: "10", description: "Tổng số ngày công tối đa cho một thực tập sinh trong một nhóm công việc" },
    { key: "SUBMISSION_MAX_FILE_SIZE_MB", value: "50", description: "Dung lượng tối đa tệp đính kèm khi nộp bài (MB)" },
    { key: "REPORT_ATTACHMENT_MAX_SIZE_MB", value: "25", description: "Dung lượng tối đa tệp đính kèm báo cáo ngày (MB)" },
  ];

  for (const s of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }
  console.log(`   ✓ Đã thiết lập ${systemSettings.length} tham số System Settings.`);

  // 2. Maintenance Config Default
  await prisma.maintenanceConfig.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: {
      key: "DEFAULT",
      enabled: false,
      status: "ONLINE",
      title: "Hệ thống đang bảo trì",
      message: "Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.",
      bypassPermissions: ["MAINTENANCE_MANAGE", "MAINTENANCE_BYPASS"],
      bypassRoles: ["ADMIN"],
      bypassIps: [],
    },
  });
  console.log("   ✓ Đã thiết lập cấu hình chế độ bảo trì (ONLINE).");

  // 3. Quy định thực tập (Regulation)
  const defaultRegulationTitle = "Nội quy thực tập và Quy định bảo mật NexCampus 2026";
  let regulation = await prisma.regulation.findFirst({
    where: { title: defaultRegulationTitle },
  });

  if (!regulation) {
    regulation = await prisma.regulation.create({
      data: {
        title: defaultRegulationTitle,
        content: `
          <h3>QUY ĐỊNH CHUNG VÀ CAM KẾT BẢO MẬT DÀNH CHO THỰC TẬP SINH</h3>
          <p>Chào mừng bạn đã gia nhập chương trình thực tập công nghệ tại NexCampus. Mọi thực tập sinh phải tuân thủ nghiêm túc các điều khoản dưới đây:</p>
          <ol>
            <li><strong>Thời gian và kỷ luật làm việc:</strong> Tuân thủ đúng lịch làm việc đã đăng ký (Thứ 2 đến Thứ 7). Tham gia đầy đủ các cuộc họp nhóm và họp giao ban của bộ phận.</li>
            <li><strong>Bảo mật thông tin & Sở hữu trí tuệ:</strong> Tuyệt đối không chia sẻ mã nguồn dự án, dữ liệu khách hàng hoặc thông tin nội bộ ra bên ngoài dưới mọi hình thức.</li>
            <li><strong>Quy định báo cáo tiến độ:</strong> Thực tập sinh có trách nhiệm hoàn thành và nộp Báo cáo ngày (Daily Report) trước 17:30 mỗi ngày làm việc.</li>
            <li><strong>Tiêu chuẩn công việc & Nộp bài:</strong> Hoàn thành công việc được giao đúng deadline. Nộp sản phẩm kèm tài liệu và đường dẫn minh chứng rõ ràng.</li>
            <li><strong>Tôn trọng và Hợp tác:</strong> Giữ thái độ tôn trọng đồng nghiệp, chủ động trao đổi và nhận hướng dẫn từ Mentor/Leader trực tiếp.</li>
          </ol>
        `,
        version: 1,
        isActive: true,
      },
    });
    console.log("   ✓ Đã tạo Nội quy thực tập tiêu chuẩn.");
  }

  // 4. Ký cam kết nội quy (Regulation Acknowledgments)
  const internAckEmails = ["intern@nexcampus.com", "intern.b@nexcampus.com", "intern.f@nexcampus.com", "intern.j@nexcampus.com"];
  for (const email of internAckEmails) {
    const internId = interns[email];
    if (internId && regulation) {
      await prisma.regulationAcknowledgment.upsert({
        where: {
          regulationId_internId: {
            regulationId: regulation.id,
            internId,
          },
        },
        update: {},
        create: {
          regulationId: regulation.id,
          internId,
          acknowledgedAt: getVnDate(-25, 9, 15),
          ipAddress: "14.162.145.89",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0",
        },
      });
    }
  }
  console.log(`   ✓ Đã ghi nhận ký cam kết nội quy cho ${internAckEmails.length} thực tập sinh.`);

  // 5. Mẫu thông báo hệ thống (Notification Templates)
  const NOTIFICATION_TEMPLATES = [
    {
      code: "TASK_ASSIGNED",
      name: "Phân công công việc mới",
      description: "Gửi thông báo khi thực tập sinh được giao một công việc mới",
      channels: ["WEB", "EMAIL"],
      subject: "Bạn có công việc mới: {{taskTitle}}",
      title: "Giao việc mới",
      content: 'Bạn vừa được giao công việc <strong>"{{taskTitle}}"</strong>. Hạn nộp dự kiến: <strong>{{deadline}}</strong>. Vui lòng kiểm tra và bắt đầu xử lý.',
      variables: ["taskTitle", "deadline", "taskUrl"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "TASK_SUBMITTED",
      name: "Bài nộp công việc mới cần duyệt",
      description: "Gửi thông báo cho Leader khi thực tập sinh nộp bài làm",
      channels: ["WEB", "EMAIL"],
      subject: "Bài nộp mới: {{internName}} đã nộp công việc {{taskTitle}}",
      title: "Bài nộp mới cần duyệt",
      content: 'Thực tập sinh <strong>{{internName}}</strong> đã nộp bài làm cho công việc <strong>"{{taskTitle}}"</strong> (Lần nộp thứ {{attempt}}). Vui lòng kiểm tra và chấm điểm.',
      variables: ["internName", "taskTitle", "attempt", "submissionUrl"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "SUBMISSION_REVIEWED",
      name: "Kết quả đánh giá bài nộp công việc",
      description: "Gửi thông báo cho thực tập sinh khi Leader đánh giá bài nộp",
      channels: ["WEB", "EMAIL"],
      subject: "Kết quả chấm bài công việc: {{taskTitle}}",
      title: "Kết quả duyệt bài nộp",
      content: 'Bài nộp của bạn cho công việc <strong>"{{taskTitle}}"</strong> đã được đánh giá: <strong>{{status}}</strong>. Nhận xét của Leader: {{feedback}}.',
      variables: ["taskTitle", "status", "feedback"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "DAILY_REPORT_REMINDER",
      name: "Nhắc nhở nộp báo cáo ngày",
      description: "Tự động nhắc nhở thực tập sinh nộp báo cáo ngày trước giờ chốt 17:30",
      channels: ["WEB", "EMAIL"],
      subject: "Nhắc nhở: Đừng quên nộp báo cáo ngày hôm nay (trước 17:30)",
      title: "Nhắc nhở nộp báo cáo ngày",
      content: "Chào bạn, hôm nay bạn đã hoàn thành những công việc gì? Vui lòng gửi Báo cáo ngày trước <strong>17:30</strong> để Leader theo dõi tiến độ kỳ thực tập nhé!",
      variables: ["internName", "reportDeadline"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "DAILY_REPORT_SUBMITTED",
      name: "Báo cáo ngày mới của thực tập sinh",
      description: "Thông báo cho Leader khi thực tập sinh gửi báo cáo ngày",
      channels: ["WEB"],
      subject: null,
      title: "Báo cáo ngày mới",
      content: "Thực tập sinh <strong>{{internName}}</strong> vừa gửi báo cáo ngày hôm nay.",
      variables: ["internName", "reportDate"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "WEEKLY_EVALUATION_PUBLISHED",
      name: "Kết quả đánh giá tiến độ tuần",
      description: "Thông báo cho thực tập sinh khi có bảng đánh giá tuần 12 tiêu chí",
      channels: ["WEB", "EMAIL"],
      subject: "Bảng đánh giá kết quả thực tập Tuần {{week}}",
      title: "Kết quả đánh giá tuần mới",
      content: "Leader đã hoàn tất đánh giá tuần <strong>{{week}}</strong> của bạn với tổng điểm: <strong>{{totalScore}}/10</strong> (Xếp loại: <strong>{{grade}}</strong>). Vui lòng kiểm tra chi tiết.",
      variables: ["week", "totalScore", "grade", "evaluationUrl"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "MEETING_INVITATION",
      name: "Thư mời tham gia cuộc họp",
      description: "Gửi lời mời họp và thông tin lịch trình cho các thành viên tham gia",
      channels: ["WEB", "EMAIL"],
      subject: "Thư mời họp: {{meetingTitle}}",
      title: "Thư mời họp mới",
      content: 'Bạn được mời tham gia cuộc họp <strong>"{{meetingTitle}}"</strong> vào lúc <strong>{{startTime}}</strong>. Địa điểm/Liên kết: {{location}}.',
      variables: ["meetingTitle", "startTime", "location", "creatorName"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "ABSENCE_SUBMITTED",
      name: "Đơn xin nghỉ phép mới",
      description: "Thông báo cho Leader khi thực tập sinh gửi đơn xin vắng mặt",
      channels: ["WEB"],
      subject: null,
      title: "Đơn xin nghỉ phép mới",
      content: "Thực tập sinh <strong>{{internName}}</strong> đã gửi đơn xin nghỉ phép vào ngày {{absenceDate}}. Lý do: {{reason}}.",
      variables: ["internName", "absenceDate", "reason"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "ABSENCE_REVIEWED",
      name: "Kết quả duyệt đơn nghỉ phép",
      description: "Thông báo cho thực tập sinh kết quả duyệt đơn xin vắng mặt",
      channels: ["WEB", "EMAIL"],
      subject: "Kết quả xét duyệt đơn nghỉ phép",
      title: "Kết quả duyệt đơn nghỉ phép",
      content: "Đơn xin nghỉ ngày <strong>{{absenceDate}}</strong> của bạn đã được Leader <strong>{{status}}</strong>. Ghi chú: {{note}}.",
      variables: ["absenceDate", "status", "note"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "WELCOME",
      name: "Chào mừng thành viên mới",
      description: "Thông báo chào mừng khi tài khoản kích hoạt thành công",
      channels: ["WEB"],
      subject: "Chào mừng bạn đến với NexCampus",
      title: "Chào mừng thành viên mới",
      content: "Chào mừng <strong>{{fullName}}</strong> đã gia nhập hệ thống quản lý thực tập sinh NexCampus! Hãy cập nhật hồ sơ và chuẩn bị cho kỳ thực tập tuyệt vời nhé.",
      variables: ["fullName"],
      isSystem: true,
      isActive: true,
    },
  ];

  for (const tpl of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { code: tpl.code },
      update: {
        name: tpl.name,
        description: tpl.description,
        channels: tpl.channels,
        subject: tpl.subject,
        title: tpl.title,
        content: tpl.content,
        variables: tpl.variables,
        isSystem: tpl.isSystem,
        isActive: tpl.isActive,
      },
      create: {
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        channels: tpl.channels,
        subject: tpl.subject,
        title: tpl.title,
        content: tpl.content,
        variables: tpl.variables,
        isSystem: tpl.isSystem,
        isActive: tpl.isActive,
      },
    });
  }
  console.log(`   ✓ Đã đồng bộ ${NOTIFICATION_TEMPLATES.length} mẫu thông báo.`);

  // 6. Thông báo mẫu trong ứng dụng (In-App Notifications)
  const internAUserId = internUsers["intern@nexcampus.com"];
  const internBUserId = internUsers["intern.b@nexcampus.com"];
  const leaderEngUserId = leaders["leader@nexcampus.com"];

  if (internAUserId) {
    await prisma.notification.createMany({
      data: [
        {
          userId: internAUserId,
          type: "TASK_ASSIGNED",
          priority: "NORMAL",
          title: "Công việc mới được giao",
          content: 'Bạn vừa được giao task: "Backend Module 8: Thiết kế kiến trúc API Service 8". Hạn chốt: 18:00.',
          actionUrl: "/intern/tasks",
          isRead: true,
          readAt: getVnDate(-5, 9, 0),
          createdAt: getVnDate(-5, 8, 30),
        },
        {
          userId: internAUserId,
          type: "WEEKLY_EVALUATION_PUBLISHED",
          priority: "HIGH",
          title: "Đánh giá tuần mới",
          content: "Tech Lead đã hoàn tất đánh giá tuần 7 của bạn với điểm số 9.8 (Xếp loại: TỐT).",
          actionUrl: "/intern/weekly-evaluation",
          isRead: true,
          readAt: getVnDate(-1, 10, 0),
          createdAt: getVnDate(-1, 9, 0),
        },
      ],
    });
  }

  if (internBUserId) {
    await prisma.notification.createMany({
      data: [
        {
          userId: internBUserId,
          type: "SUBMISSION_REVIEWED",
          priority: "HIGH",
          title: "Kết quả đánh giá bài nộp",
          content: 'Bài nộp của bạn cho công việc "Frontend Task 1" bị từ chối (REJECTED). Vui lòng xem phản hồi của Leader và sửa lại.',
          actionUrl: "/intern/tasks",
          isRead: false, // Chưa đọc!
          createdAt: getVnDate(-20, 11, 0),
        },
        {
          userId: internBUserId,
          type: "DAILY_REPORT_REMINDER",
          priority: "URGENT",
          title: "Nhắc nhở nộp báo cáo ngày",
          content: "Đã 17:00 rồi! Đừng quên nộp báo cáo ngày hôm nay trước 17:30 nhé!",
          actionUrl: "/intern/daily-report",
          isRead: false, // Chưa đọc!
          createdAt: getVnDate(0, 17, 0),
        },
      ],
    });
  }

  if (leaderEngUserId) {
    await prisma.notification.createMany({
      data: [
        {
          userId: leaderEngUserId,
          type: "TASK_SUBMITTED",
          priority: "HIGH",
          title: "Bài nộp mới cần duyệt",
          content: 'Thực tập sinh Trần Thị Bình vừa nộp bài làm cho task "Frontend Task 5: Tối ưu hoá tải ảnh".',
          actionUrl: "/leader/tasks",
          isRead: false, // Leader chưa đọc!
          createdAt: getVnDate(0, 10, 15),
        },
        {
          userId: leaderEngUserId,
          type: "DAILY_REPORT_SUBMITTED",
          priority: "NORMAL",
          title: "Báo cáo ngày mới",
          content: "Nguyễn Văn Thực Tập Sinh vừa gửi báo cáo ngày hôm nay (22/09/2026).",
          actionUrl: "/leader/daily-reports",
          isRead: true,
          readAt: getVnDate(0, 16, 40),
          createdAt: getVnDate(0, 16, 35),
        },
      ],
    });
  }
  console.log("   ✓ Đã tạo các thông báo in-app (Read & Unread).");

  // 7. Lịch sử xuất báo cáo (Export Histories)
  const internCProfileId = interns["intern.c@nexcampus.com"];
  if (internCProfileId) {
    await prisma.exportHistory.create({
      data: {
        type: "INTERNSHIP_SUMMARY",
        entityType: "INTERN",
        entityId: internCProfileId,
        fileName: "bang_tong_hop_ket_qua_thuc_tap_le_hoang_long.pdf",
        storagePath: "exports/intern_c_summary_report.pdf",
        fileUrl: "https://storage.nexcampus.com/exports/intern_c_summary_report.pdf",
        createdById: adminId,
        expiresAt: getVnDate(30, 0, 0),
        createdAt: getVnDate(-20, 15, 0),
      },
    });
  }
  console.log("   ✓ Đã tạo bản ghi lịch sử xuất file PDF (ExportHistory).");

  // 8. Nhật ký kiểm toán (Audit Logs)
  const auditLogs = [
    { actorId: adminId, action: "USER_CREATE", targetType: "USER", targetId: adminId, details: { email: "admin@nexcampus.com" }, offset: -55 },
    { actorId: adminId, action: "SYSTEM_SETTING_UPDATE", targetType: "SYSTEM_SETTING", targetId: "DAILY_REPORT_DEADLINE_TIME", details: { value: "17:30" }, offset: -50 },
    { actorId: leaderEngUserId, action: "TASK_CREATE", targetType: "TASK", targetId: "BE-CORE-001", details: { code: "BE-CORE-001" }, offset: -42 },
    { actorId: leaderEngUserId, action: "TASK_ASSIGNMENT_REVIEW", targetType: "TASK_SUBMISSION", targetId: "submission-1", details: { status: "APPROVED" }, offset: -40 },
    { actorId: leaderEngUserId, action: "WEEKLY_EVALUATION_CREATE", targetType: "WEEKLY_EVALUATION", targetId: "eval-w1", details: { week: 1, score: 9.5 }, offset: -35 },
    { actorId: internAUserId, action: "DAILY_REPORT_SUBMIT", targetType: "DAILY_REPORT", targetId: "report-today", details: { date: "2026-09-22" }, offset: 0 },
  ];

  for (const log of auditLogs) {
    if (!log.actorId) continue;
    await prisma.auditLog.create({
      data: {
        actorId: log.actorId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        details: log.details,
        ipAddress: "127.0.0.1",
        userAgent: "NexCampus-Enterprise-Client",
        createdAt: getVnDate(log.offset, 14, 0),
      },
    });
  }
  console.log("   ✓ Đã tạo các bản ghi nhật ký kiểm toán (AuditLog).");

  return { regulationId: regulation.id };
}
