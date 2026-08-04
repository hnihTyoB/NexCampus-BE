import { PrismaClient } from "@prisma/client";
import { seedSystem } from "./seed/system.seed";
import { seedDepartments } from "./seed/departments.seed";
import { seedUsers } from "./seed/users.seed";
import { seedInterns } from "./seed/interns.seed";
import { seedTasks } from "./seed/tasks.seed";
import { seedReports } from "./seed/reports.seed";
import { seedEvaluations } from "./seed/evaluations.seed";
import { seedMeetingsAndRelations } from "./seed/meetings.seed";

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log("-> Cleaning existing database records...");
  
  // Thứ tự xóa từ bảng con lên bảng cha để tránh lỗi khóa ngoại
  const deleteActions = [
    prisma.activityLog.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.exportHistory.deleteMany(),
    prisma.absenceRequest.deleteMany(),
    prisma.meetingParticipant.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.weeklyEvaluation.deleteMany(),
    prisma.reportAttachment.deleteMany(),
    prisma.dailyReport.deleteMany(),
    prisma.submissionAttachment.deleteMany(),
    prisma.taskSubmission.deleteMany(),
    prisma.taskAssignment.deleteMany(),
    prisma.taskAttachment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.taskGroupMember.deleteMany(),
    prisma.taskGroup.deleteMany(),
    prisma.notificationSetting.deleteMany(),
    prisma.intern.deleteMany(),
    prisma.leaderDepartment.deleteMany(),
    prisma.leader.deleteMany(),
    prisma.applicationAttachment.deleteMany(),
    prisma.applicationInvite.deleteMany(),
    prisma.application.deleteMany(),
    prisma.regulation.deleteMany(),
    prisma.user.deleteMany(),
    prisma.position.deleteMany(),
    prisma.department.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.notificationTemplate.deleteMany(),
    prisma.role.deleteMany(),
  ];

  await prisma.$transaction(deleteActions);
  console.log("   ✓ Database cleaned successfully.");
}

async function main() {
  // Quy tắc an toàn môi trường
  if (process.env.NODE_ENV === "production") {
    console.error("CẢNH BÁO AN TOÀN: Không được phép chạy seed trên môi trường PRODUCTION!");
    process.exit(1);
  }

  console.log("=== BẮT ĐẦU SEED HỆ THỐNG NEXCAMPUS ===");
  
  // Dọn dẹp DB trước khi seed để tránh conflict dữ liệu cũ
  await cleanDatabase();

  // 1. Dữ liệu hệ thống tĩnh & Cấu hình trước
  await seedSystem(prisma);
  
  // 2. Phòng ban & Vị trí (Nền tảng cho tài khoản)
  const { deptMap, posMap } = await seedDepartments(prisma);
  
  // 3. Người dùng & vai trò (Tạo Admin, 5 Leaders, 14 Users cho Interns)
  const { roleMap, leaders, internUsers } = await seedUsers(prisma, deptMap);
  
  // 4. Tạo hồ sơ Intern & Liên kết phòng ban, Leader quản lý
  const interns = await seedInterns(prisma, internUsers, leaders, deptMap, posMap);
  
  // 5. Tạo công việc & Giao việc (Áp dụng các kịch bản hoàn thành/trễ hạn/blocked)
  await seedTasks(prisma, interns, leaders);
  
  // 6. Seed Daily Reports (Theo dõi tiến độ hàng ngày)
  await seedReports(prisma, interns);
  
  // 7. Seed Weekly Evaluations (Đánh giá tiến độ hàng tuần)
  await seedEvaluations(prisma, interns, leaders);
  
  // 8. Seed Lịch họp, Applications, Invites, Logs
  await seedMeetingsAndRelations(prisma, interns, leaders);

  console.log("=== SEED DỮ LIỆU NEXCAMPUS HOÀN THÀNH XUẤT SẮC ===");
}

main()
  .catch((e) => {
    console.error("Lỗi khi chạy seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
