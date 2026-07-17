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
    },
    {
      type: "TASK_SUBMISSION",
      titleTemplate: "Bản nộp bài mới cần duyệt",
      contentTemplate:
        'Thực tập sinh {{internName}} đã nộp bài cho công việc "{{taskTitle}}" (Lần {{attempt}}).',
    },
    {
      type: "SUBMISSION_REVIEW",
      titleTemplate: "Kết quả duyệt bài nộp",
      contentTemplate:
        'Bài nộp cho công việc "{{taskTitle}}" (Lần {{attempt}}) đã được duyệt: {{reviewStatus}}.',
    },
    {
      type: "DAILY_REPORT",
      titleTemplate: "Báo cáo hàng ngày mới",
      contentTemplate: "Thực tập sinh {{internName}} đã gửi báo cáo hàng ngày.",
    },
    {
      type: "WEEKLY_EVALUATION",
      titleTemplate: "Đánh giá hàng tuần mới",
      contentTemplate:
        "Bạn nhận được đánh giá tuần {{week}} với tổng điểm là {{totalScore}}/10.",
    },
    {
      type: "TASK_REMINDER",
      titleTemplate: "Nhắc nhở hoàn thành công việc",
      contentTemplate:
        'Công việc "{{taskTitle}}" của bạn có hạn nộp vào lúc {{deadline}}. Vui lòng hoàn thành đúng hạn.',
    },
    {
      type: "EVALUATION_REMINDER",
      titleTemplate: "Nhắc nhở đánh giá thực tập sinh",
      contentTemplate:
        'Thực tập sinh {{internName}} chưa có đánh giá cho tuần {{week}}. Vui lòng thực hiện đánh giá.',
    },
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type: t.type },
      update: {
        titleTemplate: t.titleTemplate,
        contentTemplate: t.contentTemplate,
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
