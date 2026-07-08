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
