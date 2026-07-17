import { prisma } from "./database/prisma.client";
import { PdfService } from "./common/services/pdf.service";
import { PuppeteerManager } from "./common/services/puppeteer.manager";
import fs from "fs";
import { ASSIGNMENT_STATUS, REVIEW_STATUS } from "./common/constants/status.constant";

async function main() {
  console.log("=== BẮT ĐẦU TEST XUẤT PDF ===");

  // 1. Roles
  const leaderRole = await prisma.role.findUniqueOrThrow({ where: { name: "LEADER" } });
  const internRole  = await prisma.role.findUniqueOrThrow({ where: { name: "INTERN" } });

  // 2. Leader User
  let leaderUser = await prisma.user.findFirst({ where: { role: { name: "LEADER" } } });
  if (!leaderUser) {
    leaderUser = await prisma.user.create({
      data: {
        email: `leader-test-${Date.now()}@nexcampus.com`,
        password: "hashedpassword123",
        fullName: "Nguyễn Văn Trưởng Nhóm",
        roleId: leaderRole.id,
        isActive: true,
      },
    });
  }
  console.log("Leader:", leaderUser.fullName);

  // 3. Intern
  let intern = await prisma.intern.findFirst({ include: { user: true } });
  if (!intern) {
    const internUser = await prisma.user.create({
      data: {
        email: `intern-test-${Date.now()}@nexcampus.com`,
        password: "hashedpassword123",
        fullName: "Trần Thực Tập Sinh",
        roleId: internRole.id,
        isActive: true,
      },
    });
    intern = await prisma.intern.create({
      data: {
        userId: internUser.id,
        leaderId: leaderUser.id,
        fullName: "Trần Thực Tập Sinh",
        phone: "0987654321",
        department: "Kỹ thuật Phần mềm",
        position: "Backend Developer Intern",
        startDate: new Date("2026-07-07"),
        duration: 3,
      },
      include: { user: true },
    });
  }
  console.log("Intern:", intern.fullName);

  // 4. Weekly Evaluation tuần 2 (để có tuần trước để so sánh)
  // 4a. Tuần 1 (previous week)
  let evalWeek1 = await prisma.weeklyEvaluation.findFirst({
    where: { internId: intern.id, week: 1 },
  });
  if (!evalWeek1) {
    evalWeek1 = await prisma.weeklyEvaluation.create({
      data: {
        internId: intern.id,
        leaderId: leaderUser.id,
        week: 1,
        communication: 7.5,
        attitude: 8.0,
        learning: 7.0,
        coding: 7.5,
        totalScore: 7.5,
        comment: "Tuần đầu tiên còn bỡ ngỡ nhưng đã thể hiện thái độ học hỏi tốt.",
        aiCommunication: 7.0,
        aiAttitude: 7.5,
        aiLearning: 7.0,
        aiCoding: 7.2,
        aiComment: "Tuần đầu tiên thực tập sinh cần làm quen với môi trường làm việc.",
        aiGeneratedAt: new Date(),
      },
    });
  }
  console.log("Đã chuẩn bị WeeklyEvaluation tuần 1");

  // 4b. Tuần 2 (current week - sẽ xuất PDF)
  let evalWeek2 = await prisma.weeklyEvaluation.findFirst({
    where: { internId: intern.id, week: 2 },
  });
  if (!evalWeek2) {
    evalWeek2 = await prisma.weeklyEvaluation.create({
      data: {
        internId: intern.id,
        leaderId: leaderUser.id,
        week: 2,
        communication: 8.5,
        attitude: 9.0,
        learning: 8.5,
        coding: 8.5,
        totalScore: 8.6,
        comment:
          "Thực tập sinh đã có tiến bộ rõ rệt so với tuần trước. Chủ động trao đổi với team, " +
          "hoàn thành đúng hạn các task được giao, code rõ ràng và có comment đầy đủ. " +
          "Cần tập trung hơn vào việc viết Unit Test và tối ưu thời gian review PR.",
        aiCommunication: 8.0,
        aiAttitude: 8.5,
        aiLearning: 8.5,
        aiCoding: 8.2,
        aiComment:
          "Điểm mạnh:\n" +
          "• Chủ động hỏi Leader và đồng đội khi gặp vướng mắc\n" +
          "• Code rõ ràng, có comment đầy đủ và tuân thủ coding convention\n" +
          "• Báo cáo Daily Report đều đặn 7/7 ngày trong tuần\n\n" +
          "Cần cải thiện:\n" +
          "• Cần viết Unit Test cho các API mới triển khai\n" +
          "• Cần tối ưu thời gian giải quyết Pull Request (hiện tại còn chậm)\n" +
          "• Nên review lại code trước khi submit để giảm số lần bị reject\n\n" +
          "Khuyến nghị tuần sau:\n" +
          "Tập trung hoàn thiện module Export PDF và viết ít nhất 5 test case cho các API đã làm. " +
          "Đặt mục tiêu giảm số lần submit bị reject xuống dưới 1 lần/task.",
        aiGeneratedAt: new Date(),
      },
    });
  }
  console.log("Đã chuẩn bị WeeklyEvaluation tuần 2");

  // 5. Tạo DailyReports cho tuần 2 (7 ngày)
  const internStart = new Date("2026-07-07");
  const week2Start = new Date(internStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const existingReports = await prisma.dailyReport.count({ where: { internId: intern.id } });
  if (existingReports === 0) {
    for (let i = 0; i < 7; i++) {
      const reportDate = new Date(week2Start.getTime() + i * 24 * 60 * 60 * 1000);
      await prisma.dailyReport.create({
        data: {
          internId: intern.id,
          content: `Daily Report ngày ${i + 1}: Hoàn thành các task được giao, tham gia standup meeting.`,
          createdAt: reportDate,
        },
      });
    }
    console.log("Đã tạo 7 DailyReports cho tuần 2");
  }

  // 6. Tạo Tasks + TaskAssignments + Submissions cho tuần 2
  const existingAssignments = await prisma.taskAssignment.count({
    where: { internId: intern.id },
  });

  if (existingAssignments === 0) {
    const tasksData = [
      { code: "BE-001", title: "Thiết kế API Login & JWT Auth", status: ASSIGNMENT_STATUS.DONE as const, submissions: 2, lastReject: true },
      { code: "BE-002", title: "API User Management (CRUD)", status: ASSIGNMENT_STATUS.DONE as const, submissions: 1, lastReject: false },
      { code: "BE-003", title: "Tích hợp Supabase Storage", status: ASSIGNMENT_STATUS.DONE as const, submissions: 2, lastReject: false },
      { code: "BE-004", title: "Module Export PDF (Puppeteer)", status: ASSIGNMENT_STATUS.REVIEW as const, submissions: 1, lastReject: false },
      { code: "BE-005", title: "Viết Unit Test cho Auth Module", status: ASSIGNMENT_STATUS.IN_PROGRESS as const, submissions: 0, lastReject: false },
    ];

    for (const t of tasksData) {
      const deadline = new Date(week2Start.getTime() + 6 * 24 * 60 * 60 * 1000);
      const task = await prisma.task.create({
        data: {
          code: t.code,
          title: t.title,
          deadline,
          createdBy: leaderUser.id,
        },
      });

      const assignment = await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          internId: intern.id,
          assignedBy: leaderUser.id,
          status: t.status,
        },
      });

      // Tạo submissions
      for (let i = 0; i < t.submissions; i++) {
        const isLast = i === t.submissions - 1;
        const isRejected = t.lastReject && !isLast;
        await prisma.taskSubmission.create({
          data: {
            assignmentId: assignment.id,
            attempt: i + 1,
            note: `Lần nộp thứ ${i + 1}`,
            reviewStatus: isRejected ? REVIEW_STATUS.REJECTED : (isLast && t.status === ASSIGNMENT_STATUS.DONE ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.PENDING),
            reviewedBy: isRejected || (isLast && t.status === ASSIGNMENT_STATUS.DONE) ? leaderUser.id : null,
            reviewedAt: isRejected || (isLast && t.status === ASSIGNMENT_STATUS.DONE) ? new Date() : null,
          },
        });
      }
      console.log(`Task ${t.code}: ${t.title} – ${t.status}`);
    }
  }

  // 7. Gọi PdfService để sinh PDF
  console.log("\nĐang tiến hành tạo PDF Buffer...");
  const pdfService = new PdfService();
  try {
    const pdfBuffer = await pdfService.generateWeeklyEvaluationBuffer(evalWeek2.id);
    const localFilePath = "./weekly-report-test.pdf";
    fs.writeFileSync(localFilePath, pdfBuffer);
    console.log("✅ Đã ghi file PDF cục bộ thành công tại:", localFilePath);
    console.log("📄 Mở file này để kiểm tra giao diện PDF.");
  } catch (error) {
    console.error("❌ Lỗi khi sinh PDF:", error);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await PuppeteerManager.getInstance().closeBrowser();
  });
