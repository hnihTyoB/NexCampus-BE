/**
 * seed-ai-test.ts
 * Seed dữ liệu mẫu để test tính năng AI Weekly Evaluation Assistant.
 * Tạo: Intern profile, 5 DailyReports, 1 Task + Assignment + 3 TaskSubmissions cho tuần 1.
 *
 * Chạy: npx tsx prisma/seed-ai-test.ts
 */

import {
  PrismaClient,
  AssignmentStatus,
  ReviewStatus,
  TaskPriority,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AI test data...\n");

  // ── 1. Lấy Leader và Intern user đã có từ seed gốc ──────────────────────────
  const leaderUser = await prisma.user.findUnique({
    where: { email: "leader@nexcampus.local" },
  });
  const internUser = await prisma.user.findUnique({
    where: { email: "intern@nexcampus.local" },
  });

  if (!leaderUser || !internUser) {
    console.error('❌ Chưa chạy seed gốc. Hãy chạy "pnpm db:seed" trước.');
    process.exit(1);
  }

  console.log(`✅ Leader: ${leaderUser.fullName} (${leaderUser.id})`);
  console.log(`✅ Intern user: ${internUser.fullName} (${internUser.id})`);

  // ── 2. Tạo Intern profile (upsert theo userId) ───────────────────────────────
  // startDate = 2 tuần trước để tuần 1 có dữ liệu thực tế
  const internStartDate = new Date("2026-06-23T08:00:00.000Z"); // Thứ Hai 23/06/2026

  const intern = await prisma.intern.upsert({
    where: { userId: internUser.id },
    update: {
      leaderId: leaderUser.id,
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      department: "Engineering",
      position: "Backend Developer Intern",
      startDate: internStartDate,
      duration: 3, // 3 tháng
    },
    create: {
      userId: internUser.id,
      leaderId: leaderUser.id,
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      department: "Engineering",
      position: "Backend Developer Intern",
      startDate: internStartDate,
      duration: 3,
    },
  });

  console.log(`\n✅ Intern profile: ${intern.fullName} (${intern.id})`);
  console.log(`   startDate: ${intern.startDate.toISOString()}`);

  // Tuần 1: 23/06 → 29/06/2026
  // Tuần 2: 30/06 → 06/07/2026

  // ── 3. Tạo DailyReports cho tuần 1 (23/06 → 27/06, Mon-Fri) ────────────────
  const week1Reports = [
    {
      date: new Date("2026-06-23T09:00:00.000Z"),
      content:
        "Ngày đầu tiên nhận việc. Đã đọc tài liệu dự án NexCampus, hiểu được cấu trúc folder và tech stack (Express, Prisma, PostgreSQL). Cài đặt môi trường development thành công. Hỏi leader về quy trình làm việc và git flow.",
      prLink: null,
    },
    {
      date: new Date("2026-06-24T09:30:00.000Z"),
      content:
        "Tìm hiểu về Prisma ORM và cách tổ chức module. Đã đọc toàn bộ schema.prisma, hiểu các model và quan hệ giữa chúng. Bắt đầu viết API đầu tiên theo hướng dẫn của leader. Gặp lỗi với Prisma relation query nhưng tự tra docs và fix được.",
      prLink: "https://github.com/nexcampus/backend/pull/12",
    },
    {
      date: new Date("2026-06-25T09:00:00.000Z"),
      content:
        "Tiếp tục xây dựng API đăng ký thực tập sinh. Đã hoàn thành CRUD cơ bản cho module intern. Viết validation với Zod. Leader review và góp ý về error handling — đã sửa theo. Học được cách dùng AppError custom class.",
      prLink: "https://github.com/nexcampus/backend/pull/13",
    },
    {
      date: new Date("2026-06-26T09:15:00.000Z"),
      content:
        "Làm task authentication — JWT login/refresh token. Gặp khó khăn với bcrypt và async/await nhưng sau khi xem tài liệu đã hiểu. Đã viết middleware xác thực. Nộp PR lần đầu bị reject do thiếu validation cho token expired. Nộp lại sau khi fix.",
      prLink: "https://github.com/nexcampus/backend/pull/15",
    },
    {
      date: new Date("2026-06-27T09:00:00.000Z"),
      content:
        "Cuối tuần review lại toàn bộ code đã làm. Refactor một số chỗ theo góp ý của leader. Viết thêm comment cho các function phức tạp. Học thêm về Docker và docker-compose. PR authentication đã được APPROVED.",
      prLink: "https://github.com/nexcampus/backend/pull/15",
    },
  ];

  for (const report of week1Reports) {
    const existing = await prisma.dailyReport.findFirst({
      where: {
        internId: intern.id,
        createdAt: {
          gte: new Date(report.date.getTime() - 60000),
          lte: new Date(report.date.getTime() + 60000),
        },
      },
    });

    if (!existing) {
      await prisma.dailyReport.create({
        data: {
          internId: intern.id,
          content: report.content,
          prLink: report.prLink,
          createdAt: report.date,
          updatedAt: report.date,
        },
      });
      console.log(
        `📄 DailyReport ${report.date.toLocaleDateString("vi-VN")} created`,
      );
    } else {
      console.log(
        `📄 DailyReport ${report.date.toLocaleDateString("vi-VN")} already exists`,
      );
    }
  }

  // ── 4. Tạo Task ──────────────────────────────────────────────────────────────
  const task = await prisma.task.create({
    data: {
      title: "Xây dựng API Authentication (Login, Refresh Token, Logout)",
      description:
        "Triển khai hệ thống xác thực người dùng với JWT. Bao gồm: đăng nhập, refresh token, đăng xuất. Đảm bảo bảo mật và xử lý lỗi đúng chuẩn.",
      deadline: new Date("2026-06-28T17:00:00.000Z"),
      priority: TaskPriority.HIGH,
      createdBy: leaderUser.id,
    },
  });

  console.log(`\n✅ Task: ${task.title} (${task.id})`);

  // ── 5. Tạo TaskAssignment ────────────────────────────────────────────────────
  const assignment = await prisma.taskAssignment.create({
    data: {
      taskId: task.id,
      internId: intern.id,
      assignedBy: leaderUser.id,
      status: AssignmentStatus.DONE,
    },
  });

  console.log(`✅ TaskAssignment: ${assignment.id}`);

  // ── 6. Tạo TaskSubmissions (3 lần nộp: 2 REJECTED, 1 APPROVED) ──────────────
  const submissions = [
    {
      attempt: 1,
      prLink: "https://github.com/nexcampus/backend/pull/14",
      note: "Em đã hoàn thành API login và refresh token theo yêu cầu.",
      reviewStatus: ReviewStatus.REJECTED,
      reviewComment:
        "Thiếu xử lý trường hợp token expired. Cần thêm middleware check và trả về lỗi 401 đúng format.",
      reviewedBy: leaderUser.id,
      submittedAt: new Date("2026-06-25T14:00:00.000Z"),
      reviewedAt: new Date("2026-06-25T16:30:00.000Z"),
    },
    {
      attempt: 2,
      prLink: "https://github.com/nexcampus/backend/pull/15",
      note: "Đã thêm xử lý token expired theo góp ý. Bổ sung unit test cơ bản.",
      reviewStatus: ReviewStatus.REJECTED,
      reviewComment:
        "Refresh token chưa được invalidate sau khi dùng (security issue). Cần lưu token vào DB và xóa sau khi refresh.",
      reviewedBy: leaderUser.id,
      submittedAt: new Date("2026-06-26T10:00:00.000Z"),
      reviewedAt: new Date("2026-06-26T15:00:00.000Z"),
    },
    {
      attempt: 3,
      prLink: "https://github.com/nexcampus/backend/pull/15",
      note: "Đã sửa refresh token invalidation, lưu vào bảng refresh_tokens trong DB. Code sạch hơn, có comment đầy đủ.",
      reviewStatus: ReviewStatus.APPROVED,
      reviewComment: "Tốt! Code đã sạch và bảo mật. Merge vào develop.",
      reviewedBy: leaderUser.id,
      submittedAt: new Date("2026-06-27T09:30:00.000Z"),
      reviewedAt: new Date("2026-06-27T11:00:00.000Z"),
    },
  ];

  for (const sub of submissions) {
    await prisma.taskSubmission.create({
      data: {
        assignmentId: assignment.id,
        attempt: sub.attempt,
        prLink: sub.prLink,
        note: sub.note,
        reviewStatus: sub.reviewStatus,
        reviewComment: sub.reviewComment,
        reviewedBy: sub.reviewedBy,
        reviewedAt: sub.reviewedAt,
        submittedAt: sub.submittedAt,
        updatedAt: sub.reviewedAt,
      },
    });
    console.log(`📝 Submission #${sub.attempt}: ${sub.reviewStatus}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Seed AI test data hoàn tất!\n");
  console.log("📋 Thông tin để test:");
  console.log(`   Leader email : leader@nexcampus.local`);
  console.log(`   Leader pass  : Leader@123456`);
  console.log(`   Intern ID    : ${intern.id}`);
  console.log(`   Week để test : 1 (23/06 → 29/06/2026)`);
  console.log("\n📡 Test AI suggestion:");
  console.log(`   POST http://localhost:8888/weekly-evaluations/ai-suggestion`);
  console.log(`   Body: { "internId": "${intern.id}", "week": 1 }`);
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
