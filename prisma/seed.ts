import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { cleanDatabase } from "./seed/clean.seed";
import { seedDepartments } from "./seed/departments.seed";
import { seedUsers } from "./seed/users.seed";
import { seedInterns } from "./seed/interns.seed";
import { seedSystem } from "./seed/system.seed";
import { seedTasks } from "./seed/tasks.seed";
import { seedReports } from "./seed/reports.seed";
import { seedEvaluations } from "./seed/evaluations.seed";
import { seedMeetings } from "./seed/meetings.seed";
import { seedRecruitment } from "./seed/recruitment.seed";

// ─── UUIDv7 Seed Extension ───────────────────────────────────────────────────
// Models that use a composite primary key and do NOT have an `id` field.
// For these models we must skip id injection to avoid Prisma validation errors.
const COMPOSITE_PK_MODELS = new Set([
  "LeaderDepartment",
  "TaskGroupMember",
]);

const uuidv7Extension = {
  name: "uuidv7",
  query: {
    $allModels: {
      async create({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model) && args.data) {
          args.data.id = uuidv7();
        }
        return query(args);
      },
      async createMany({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model)) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({ ...item, id: uuidv7() }));
          } else if (args.data) {
            args.data.id = uuidv7();
          }
        }
        return query(args);
      },
      async upsert({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model) && args.create) {
          args.create.id = uuidv7();
        }
        return query(args);
      },
    },
  },
};

const baseClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

const prisma = baseClient.$extends(uuidv7Extension) as unknown as PrismaClient;

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
    console.error("CẢNH BÁO AN TOÀN: Không được phép chạy seed trên môi trường PRODUCTION mà không có cờ ALLOW_PROD_SEED=true!");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log("        BẮT ĐẦU SEED DỮ LIỆU ĐẦY ĐỦ TẤT CẢ CÁC TRƯỜNG HỢP NEXCAMPUS v2          ");
  console.log("================================================================================");

  // 0. Làm sạch DB cũ an toàn
  await cleanDatabase(prisma);

  // 1. Cơ cấu tổ chức: Phòng ban & Vị trí
  const { deptMap, posMap } = await seedDepartments(prisma);

  // 2. Dynamic RBAC, Roles, Permissions & Danh sách tài khoản người dùng
  const { roleMap, adminUser, managerUser, leaders, leaderProfiles, internUsers } =
    await seedUsers(prisma, deptMap);

  // 3. Hồ sơ Thực tập sinh (14 Interns bao quát Active, Completed, Dropped, New Joiner)
  const interns = await seedInterns(prisma, internUsers, leaders, deptMap, posMap);

  // 4. Cấu hình hệ thống, Nội quy, Mẫu thông báo, In-App Notifications, Audit Logs
  const { regulationId } = await seedSystem(prisma, adminUser.id, leaders, internUsers, interns);

  // 5. Nhóm công việc, Công việc & Bài nộp (Todo, In Progress, Review, Done, Blocked)
  await seedTasks(prisma, interns, leaders, deptMap);

  // 6. Báo cáo ngày (On-time, Late, Missed, Feedback, Blockers, Attachments)
  await seedReports(prisma, interns, leaders);

  // 7. Đánh giá tuần 12 tiêu chí (Tốt, Khá, TB, Yếu, AI Adjusted, Lịch sử 12 tuần)
  await seedEvaluations(prisma, interns, leaders);

  // 8. Lịch họp, Biên bản, Điểm danh (Meetings & Attendance)
  await seedMeetings(prisma, internUsers, leaders, deptMap);

  // 9. Tuyển dụng, Đơn ứng tuyển & Thư mời nộp hồ sơ
  await seedRecruitment(prisma, adminUser.id, leaders, deptMap, posMap, regulationId);

  console.log("\n================================================================================");
  console.log("     SEED DỮ LIỆU TOÀN DIỆN NEXCAMPUS v2 ĐÃ HOÀN TẤT XUẤT SẮC VÀ AN TOÀN        ");
  console.log("================================================================================");
  console.log("DANH SÁCH TÀI KHOẢN DEMO KIỂM THỬ:");
  console.log("  1. QUẢN TRỊ VIÊN (ADMIN):");
  console.log("     • Email: admin@nexcampus.com           | Mật khẩu: Admin@123456");
  console.log("  2. QUẢN LÝ VẬN HÀNH (MANAGER):");
  console.log("     • Email: manager@nexcampus.com         | Mật khẩu: Manager@123456");
  console.log("  3. CÁC TRƯỞNG BỘ PHẬN / MENTOR (LEADER):   | Mật khẩu: Leader@123456");
  console.log("     • Kỹ thuật phần mềm:   leader@nexcampus.com (Đỗ Hoàng Long)");
  console.log("     • Kiểm thử QA/QC:      leader.qa@nexcampus.com (Nguyễn Thuỳ Chi)");
  console.log("     • Thiết kế UI/UX:      leader.design@nexcampus.com (Phạm Quốc Bảo)");
  console.log("     • Marketing:           leader.mkt@nexcampus.com (Trần Minh Tuyết)");
  console.log("     • Nhân sự HR:          leader.hr@nexcampus.com (Lê Quang Hải)");
  console.log("  4. CÁC TRƯỜNG HỢP THỰC TẬP SINH (INTERN):  | Mật khẩu: Intern@123456");
  console.log("     • Top Performer (100% on time, 8 task DONE):  intern@nexcampus.com");
  console.log("     • Struggling (Overdue, Rejected submissions): intern.b@nexcampus.com");
  console.log("     • Completed (Đã tốt nghiệp, đủ 12 tuần):      intern.c@nexcampus.com");
  console.log("     • Dropped out (Nghỉ ngang, task dở dang):     intern.d@nexcampus.com");
  console.log("     • New joiner (Mới vào 2 ngày, UI/UX):         intern.e@nexcampus.com");
  console.log("     • Average QA (Điểm TB/Khá, có bug):           intern.f@nexcampus.com");
  console.log("     • Blocked (Task bị kẹt chờ quyền Cloud):      intern.g@nexcampus.com");
  console.log("     • Automation QA (Playwright scripts):         intern.h@nexcampus.com");
  console.log("     • Junior Frontend (Onboarding tuần đầu):      intern.i@nexcampus.com");
  console.log("     • UI/UX Designer (Design System, Figma):      intern.j@nexcampus.com");
  console.log("     • Completed Graphic Designer:                 intern.k@nexcampus.com");
  console.log("     • Content Marketing (Video TikTok xuất sắc):  intern.l@nexcampus.com");
  console.log("     • SEO Specialist (Kẹt tài khoản Ahrefs):      intern.m@nexcampus.com");
  console.log("     • HR Recruiter (Lọc CV, phỏng vấn):           intern.n@nexcampus.com");
  console.log("================================================================================\n");
}

main()
  .catch((error) => {
    console.error("LỖI KHI THỰC THI SEED:", error);
    process.exit(1);
  })
  .finally(async () => {
    await baseClient.$disconnect();
  });
