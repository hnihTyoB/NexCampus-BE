import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const roles = ["ADMIN", "LEADER", "INTERN"];
  const roleMap: Record<string, string> = {};

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap[roleName] = role.id;
    console.log(`Role ${roleName} upserted with ID ${role.id}`);
  }

  const adminEmail = "admin@nexcampus.local";
  const adminPassword = await bcrypt.hash("Admin@123456", 10);

  const leaderEmail = "leader@nexcampus.local";
  const leaderPassword = await bcrypt.hash("Leader@123456", 10);

  const internEmail = "intern@nexcampus.local";
  const internPassword = await bcrypt.hash("Intern@123456", 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPassword,
      fullName: "Admin",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPassword,
      fullName: "Admin",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: leaderEmail },
    update: {
      password: leaderPassword,
      fullName: "Leader",
      roleId: roleMap["LEADER"],
      isActive: true,
    },
    create: {
      email: leaderEmail,
      password: leaderPassword,
      fullName: "Leader",
      roleId: roleMap["LEADER"],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: internEmail },
    update: {
      password: internPassword,
      fullName: "Intern",
      roleId: roleMap["INTERN"],
      isActive: true,
    },
    create: {
      email: internEmail,
      password: internPassword,
      fullName: "Intern",
      roleId: roleMap["INTERN"],
      isActive: true,
    },
  });

  const templates = [
    {
      type: "TASK_ASSIGNMENT",
      titleTemplate: "Bạn đã được giao công việc mới",
      contentTemplate: 'Công việc: "{{taskTitle}}". Hạn nộp: {{deadline}}',
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "TASK_SUBMISSION",
      titleTemplate: "Bản nộp bài mới cần duyệt",
      contentTemplate:
        'Thực tập sinh {{internName}} đã nộp bài cho công việc "{{taskTitle}}" (Lần {{attempt}}).',
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "SUBMISSION_REVIEW",
      titleTemplate: "Kết quả duyệt bài nộp",
      contentTemplate:
        'Bài nộp cho công việc "{{taskTitle}}" (Lần {{attempt}}) đã được duyệt: {{reviewStatus}}.',
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "DAILY_REPORT",
      titleTemplate: "Báo cáo hàng ngày mới",
      contentTemplate: "Thực tập sinh {{internName}} đã gửi báo cáo hàng ngày.",
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "WEEKLY_EVALUATION",
      titleTemplate: "Đánh giá hàng tuần mới",
      contentTemplate:
        "Bạn nhận được đánh giá tuần {{week}} với tổng điểm là {{totalScore}}/10.",
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "TASK_REMINDER",
      titleTemplate: "Nhắc nhở hoàn thành công việc",
      contentTemplate:
        'Công việc "{{taskTitle}}" của bạn có hạn nộp vào lúc {{deadline}}. Vui lòng hoàn thành đúng hạn.',
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "EVALUATION_REMINDER",
      titleTemplate: "Nhắc nhở đánh giá thực tập sinh",
      contentTemplate:
        'Thực tập sinh {{internName}} chưa có đánh giá cho tuần {{week}}. Vui lòng thực hiện đánh giá.',
      emailSubjectTemplate: null,
      emailContentTemplate: null,
    },
    {
      type: "APPLICATION_INVITE",
      titleTemplate: "[NexCampus] Thư mời nộp đơn đăng ký thực tập",
      contentTemplate:
        'Chào bạn,<br/><br/>Bạn đã nhận được lời mời tham gia ứng tuyển thực tập tại NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để điền thông tin đơn ứng tuyển (liên kết này chỉ có giá trị sử dụng một lần và hết hạn sau 24 giờ):<br/><p style="margin: 16px 0;"><a href="{{applyUrl}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Nộp đơn ứng tuyển</a></p>Hoặc sao chép liên kết này vào trình duyệt của bạn:<br/><a href="{{applyUrl}}">{{applyUrl}}</a><br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
      emailSubjectTemplate: "[NexCampus] Thư mời nộp đơn đăng ký thực tập",
      emailContentTemplate:
        'Chào bạn,<br/><br/>Bạn đã nhận được lời mời tham gia ứng tuyển thực tập tại NexCampus.<br/>Vui lòng nhấn vào liên kết dưới đây để điền thông tin đơn ứng tuyển (liên kết này chỉ có giá trị sử dụng một lần và hết hạn sau 24 giờ):<br/><p style="margin: 16px 0;"><a href="{{applyUrl}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Nộp đơn ứng tuyển</a></p>Hoặc sao chép liên kết này vào trình duyệt của bạn:<br/><a href="{{applyUrl}}">{{applyUrl}}</a><br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
    {
      type: "APPLICATION_APPROVED",
      titleTemplate: "[NexCampus] Tài khoản thực tập sinh của bạn đã được tạo",
      contentTemplate:
        'Chào mừng bạn đến với NexCampus!<br/><br/>Đơn đăng ký thực tập của bạn tại NexCampus đã được phê duyệt.<br/>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
      emailSubjectTemplate: "[NexCampus] Tài khoản thực tập sinh của bạn đã được tạo",
      emailContentTemplate:
        'Chào mừng bạn đến với NexCampus!<br/><br/>Đơn đăng ký thực tập của bạn tại NexCampus đã được phê duyệt.<br/>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
    {
      type: "APPLICATION_REJECTED",
      titleTemplate: "[NexCampus] Kết quả đăng ký thực tập tại NexCampus",
      contentTemplate:
        'Chào bạn,<br/><br/>Cảm ơn bạn đã quan tâm và nộp đơn đăng ký thực tập tại NexCampus.<br/>Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa phù hợp với các tiêu chí tuyển chọn hiện tại của chúng tôi.<br/>Thông tin chi tiết về đơn đăng ký của bạn:<br/><ul><li><strong>Họ và tên:</strong> {{fullName}}</li><li><strong>Vị trí ứng tuyển:</strong> {{position}}</li><li><strong>Phòng ban:</strong> {{department}}</li></ul>Chúng tôi rất hy vọng sẽ có cơ hội được hợp tác với bạn trong các chương trình tiếp theo. Chúc bạn luôn nhiều sức khỏe và thành công trên con đường sự nghiệp sắp tới.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
      emailSubjectTemplate: "[NexCampus] Kết quả đăng ký thực tập tại NexCampus",
      emailContentTemplate:
        'Chào bạn,<br/><br/>Cảm ơn bạn đã quan tâm và nộp đơn đăng ký thực tập tại NexCampus.<br/>Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa phù hợp với các tiêu chí tuyển chọn hiện tại của chúng tôi.<br/>Thông tin chi tiết về đơn đăng ký của bạn:<br/><ul><li><strong>Họ và tên:</strong> {{fullName}}</li><li><strong>Vị trí ứng tuyển:</strong> {{position}}</li><li><strong>Phòng ban:</strong> {{department}}</li></ul>Chúng tôi rất hy vọng sẽ có cơ hội được hợp tác với bạn trong các chương trình tiếp theo. Chúc bạn luôn nhiều sức khỏe và thành công trên con đường sự nghiệp sắp tới.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
    {
      type: "USER_CREATED",
      titleTemplate: "[NexCampus] Tài khoản của bạn đã được tạo",
      contentTemplate:
        'Chào mừng bạn đến với NexCampus!<br/><br/>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
      emailSubjectTemplate: "[NexCampus] Tài khoản của bạn đã được tạo",
      emailContentTemplate:
        'Chào mừng bạn đến với NexCampus!<br/><br/>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/><ul><li><strong>Email đăng nhập:</strong> {{email}}</li><li><strong>Mật khẩu:</strong> {{password}}</li></ul>Vui lòng truy cập <a href="{{loginUrl}}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
    {
      type: "PASSWORD_RESET",
      titleTemplate: "[NexCampus] Yêu cầu khôi phục mật khẩu",
      contentTemplate:
        'Bạn vừa yêu cầu khôi phục mật khẩu vào lúc {{time}} từ IP {{ip}}.',
      emailSubjectTemplate: "[NexCampus] Yêu cầu khôi phục mật khẩu tài khoản",
      emailContentTemplate:
        'Chào {{fullName}},<br/><br/>Hệ thống NexCampus ghi nhận một yêu cầu khôi phục mật khẩu cho tài khoản của bạn với chi tiết thiết bị bên dưới:<br/><br/><table style="width:100%;border-collapse:collapse;margin:16px 0;background-color:#0f172a;color:#f8fafc;border-radius:8px;overflow:hidden;"><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;width:140px;">Thời gian yêu cầu:</td><td style="padding:10px 16px;font-weight:bold;">{{time}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Địa chỉ IP:</td><td style="padding:10px 16px;font-weight:bold;">{{ip}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Vị trí (ước tính):</td><td style="padding:10px 16px;font-weight:bold;">{{location}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Thiết bị:</td><td style="padding:10px 16px;font-weight:bold;">{{device}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Hệ điều hành:</td><td style="padding:10px 16px;font-weight:bold;">{{os}}</td></tr><tr><td style="padding:10px 16px;color:#94a3b8;">Trình duyệt:</td><td style="padding:10px 16px;font-weight:bold;">{{browser}}</td></tr></table>Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu mới (liên kết có hiệu lực trong 1 giờ):<br/><p style="margin: 20px 0;"><a href="{{resetLink}}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;box-shadow:0 4px 12px rgba(79,70,229,0.3);">🔑 Đặt lại mật khẩu</a></p>Hoặc sao chép liên kết này vào trình duyệt:<br/><a href="{{resetLink}}">{{resetLink}}</a><br/><br/>Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này hoặc liên hệ quản trị viên.<br/><br/>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
    {
      type: "SECURITY_ALERT",
      titleTemplate: "[NexCampus] Cảnh báo đăng nhập hệ thống",
      contentTemplate:
        'Tài khoản của bạn vừa đăng nhập thành công vào lúc {{time}} từ IP {{ip}} ({{location}}).',
      emailSubjectTemplate: "[NexCampus] Cảnh báo bảo mật: Đăng nhập từ thiết bị/vị trí mới",
      emailContentTemplate:
        'Chào {{fullName}},<br/><br/>Hệ thống NexCampus ghi nhận một lượt đăng nhập mới vào tài khoản của bạn với chi tiết bảo mật bên dưới:<br/><br/><table style="width:100%;border-collapse:collapse;margin:16px 0;background-color:#0f172a;color:#f8fafc;border-radius:8px;overflow:hidden;"><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;width:140px;">Thời gian:</td><td style="padding:10px 16px;font-weight:bold;">{{time}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Địa chỉ IP:</td><td style="padding:10px 16px;font-weight:bold;">{{ip}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Vị trí (ước tính):</td><td style="padding:10px 16px;font-weight:bold;">{{location}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Thiết bị:</td><td style="padding:10px 16px;font-weight:bold;">{{device}}</td></tr><tr style="border-bottom:1px solid #1e293b;"><td style="padding:10px 16px;color:#94a3b8;">Hệ điều hành:</td><td style="padding:10px 16px;font-weight:bold;">{{os}}</td></tr><tr><td style="padding:10px 16px;color:#94a3b8;">Trình duyệt:</td><td style="padding:10px 16px;font-weight:bold;">{{browser}}</td></tr></table>Nếu chính bạn thực hiện đăng nhập này, bạn có thể bỏ qua email này.<br/><br/>Nếu <strong style="color:#ef4444;">ĐÂY KHÔNG PHẢI LÀ BẠN</strong>, tài khoản của bạn có nguy cơ bị xâm nhập. Vui lòng nhấn vào nút bên dưới để vô hiệu hóa phiên đăng nhập này ngay lập tức:<br/><p style="margin: 20px 0;"><a href="{{revokeUrl}}" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;box-shadow:0 4px 12px rgba(220,38,38,0.3);">⚠️ ĐÂY KHÔNG PHẢI TÔI (Khóa phiên ngay)</a></p>Trân trọng,<br/>Đội ngũ NexCampus.',
    },
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type: t.type },
      update: {
        titleTemplate: t.titleTemplate,
        contentTemplate: t.contentTemplate,
        emailSubjectTemplate: t.emailSubjectTemplate,
        emailContentTemplate: t.emailContentTemplate,
      },
      create: t,
    });
    console.log(`NotificationTemplate ${t.type} upserted`);
  }

  // Create a default active regulation if none exists
  const regulationCount = await prisma.regulation.count();
  if (regulationCount === 0) {
    await prisma.regulation.create({
      data: {
        title: "Quy định thực tập tại NexCampus",
        content: `
          <h3>QUY ĐỊNH CHUNG DÀNH CHO THỰC TẬP SINH</h3>
          <p>Chào mừng bạn đã gia nhập NexCampus. Vui lòng đọc kỹ các điều khoản dưới đây trước khi bắt đầu kỳ thực tập:</p>
          <ol>
            <li><strong>Thời gian làm việc:</strong> Thực hiện đầy đủ số giờ thực tập đã cam kết mỗi tuần. Đi làm đúng giờ.</li>
            <li><strong>Bảo mật thông tin:</strong> Tuyệt đối không tiết lộ mã nguồn, dữ liệu dự án, hoặc thông tin mật của doanh nghiệp cho bất kỳ bên thứ ba nào.</li>
            <li><strong>Báo cáo công việc:</strong> Gửi báo cáo hàng ngày (Daily Report) đúng giờ và đầy đủ trước 18h00 mỗi ngày làm việc.</li>
            <li><strong>Thái độ làm việc:</strong> Tôn trọng đồng nghiệp, chủ động học hỏi và tuân thủ sự hướng dẫn của Mentor/Leader.</li>
          </ol>
        `,
        version: 1,
        isActive: true,
      },
    });
    console.log("Default active regulation created");
  }

  // Synchronize Leader profiles for users with role LEADER
  const leaderUsers = await prisma.user.findMany({
    where: {
      role: { name: "LEADER" },
      deletedAt: null,
    },
  });

  for (const user of leaderUsers) {
    const existing = await prisma.leader.findUnique({
      where: { userId: user.id },
    });
    if (!existing) {
      await prisma.leader.create({
        data: { userId: user.id },
      });
      console.log(`✓ Created leader record for ${user.email}`);
    }
  }

  // System settings
  const settings = [
    { key: "SUBMISSION_MAX_FILE_SIZE_MB", value: "50" }
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
    console.log(`✓ System setting ${s.key} upserted with value "${s.value}"`);
  }

  // Create default Department and Position
  const dept = await prisma.department.upsert({
    where: { name: "Kỹ thuật Công nghệ" },
    update: {},
    create: { name: "Kỹ thuật Công nghệ" },
  });

  const pos = await prisma.position.findFirst({
    where: { departmentId: dept.id, name: "Thực tập sinh Frontend" },
  }) || await prisma.position.create({
    data: { departmentId: dept.id, name: "Thực tập sinh Frontend" },
  });

  // Create mock intern profile
  const leaderUser = await prisma.user.findUnique({ where: { email: leaderEmail } });
  const internUser = await prisma.user.findUnique({ where: { email: internEmail } });

  if (leaderUser && internUser) {
    const existingIntern = await prisma.intern.findUnique({
      where: { userId: internUser.id },
    });

    if (!existingIntern) {
      const startOfInternship = new Date();
      // Set to 3 days ago to make sure they are currently in week 1
      startOfInternship.setDate(startOfInternship.getDate() - 3);

      const mockIntern = await prisma.intern.create({
        data: {
          userId: internUser.id,
          leaderId: leaderUser.id,
          fullName: "Nguyễn Văn Thực Tập",
          phone: "0987654321",
          departmentId: dept.id,
          positionId: pos.id,
          startDate: startOfInternship,
          duration: 3, // 3 months
          status: "ACTIVE",
        },
      });
      console.log(`✓ Created mock intern profile for ${internUser.email}`);

      // Seed Daily Reports
      const reportDate1 = new Date(startOfInternship);
      const reportDate2 = new Date(startOfInternship);
      reportDate2.setDate(reportDate2.getDate() + 1);

      await prisma.dailyReport.createMany({
        data: [
          {
            internId: mockIntern.id,
            content: "Tìm hiểu cấu trúc dự án Next.js, cài đặt môi trường và chạy thử thành công dự án. Giao tiếp tốt với các thành viên và chủ động hỏi đáp khi gặp lỗi.",
            createdAt: reportDate1,
            updatedAt: reportDate1,
          },
          {
            internId: mockIntern.id,
            content: "Hoàn thành code phần Header và Footer cho trang chủ. Đã đẩy PR lên git và gửi mentor review. Tiếp thu tốt các ý kiến đóng góp về CSS.",
            createdAt: reportDate2,
            updatedAt: reportDate2,
          },
        ],
      });
      console.log("✓ Created mock daily reports for the intern");

      // Seed Tasks
      const taskGroup = await prisma.taskGroup.upsert({
        where: { name: "Mẫu Đánh Giá Tuần" },
        update: {},
        create: { name: "Mẫu Đánh Giá Tuần", description: "Các task thực tập tuần 1" },
      });

      const task = await prisma.task.create({
        data: {
          taskGroupId: taskGroup.id,
          code: "TASK-001",
          title: "Xây dựng trang Weekly Evaluation",
          description: "Thiết kế và code giao diện trang Weekly Evaluation với 12 tiêu chí xếp loại.",
          deadline: new Date(reportDate2.getTime() + 24 * 60 * 60 * 1000),
          priority: "HIGH",
          createdBy: leaderUser.id,
        },
      });

      const assignment = await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          internId: mockIntern.id,
          assignedBy: leaderUser.id,
          status: "DONE",
        },
      });

      await prisma.taskSubmission.create({
        data: {
          assignmentId: assignment.id,
          attempt: 1,
          prLink: "https://github.com/NexCampus/FE/pull/42",
          videoDemo: "https://youtube.com/watch?v=demo",
          note: "Em đã hoàn thành giao diện 12 tiêu chí theo đúng thiết kế.",
          reviewStatus: "APPROVED",
          reviewComment: "Giao diện rất đẹp, code sạch sẽ, tính toán điểm chuẩn xác.",
          reviewedBy: leaderUser.id,
          reviewedAt: new Date(),
        },
      });
      console.log("✓ Created mock tasks, assignment, and submissions");
    }
  }

  console.log("Seed completed successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
