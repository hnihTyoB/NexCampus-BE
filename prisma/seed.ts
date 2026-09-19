import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { uuidv7 } from "uuidv7";

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
      // prisma.model.create() — Prisma pre-populates `id` from @default(uuid())
      // before calling this hook, so `'id' in args.data` is always true for
      // models that have an id field.
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
      // For upsert, Prisma does NOT pre-populate id in args.create, so we use
      // the model name check to know whether to inject.
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


// ── 1. Danh Mục Quyền Hệ Thống Chuẩn Hóa (Permissions Matrix) ───────────────
interface PermissionDef {
  name: string;
  resource: string;
  action: string;
  description: string;
}

const SYSTEM_PERMISSIONS: PermissionDef[] = [
  // User Management
  { name: "USER_READ", resource: "USER", action: "READ", description: "Xem danh sách và chi tiết người dùng" },
  { name: "USER_CREATE", resource: "USER", action: "CREATE", description: "Tạo tài khoản người dùng mới" },
  { name: "USER_UPDATE", resource: "USER", action: "UPDATE", description: "Cập nhật trạng thái và thông tin người dùng" },
  { name: "USER_DELETE", resource: "USER", action: "DELETE", description: "Xóa mềm người dùng" },
  { name: "USER_ROLE_ASSIGN", resource: "USER", action: "ASSIGN_ROLE", description: "Phân vai trò cho người dùng" },

  // Role & Permission Management
  { name: "ROLE_READ", resource: "ROLE", action: "READ", description: "Xem danh sách vai trò và phân quyền" },
  { name: "ROLE_CREATE", resource: "ROLE", action: "CREATE", description: "Tạo vai trò mới" },
  { name: "ROLE_UPDATE", resource: "ROLE", action: "UPDATE", description: "Chỉnh sửa thông tin vai trò" },
  { name: "ROLE_DELETE", resource: "ROLE", action: "DELETE", description: "Xóa vai trò" },
  { name: "PERMISSION_READ", resource: "PERMISSION", action: "READ", description: "Xem danh mục quyền hệ thống" },
  { name: "ROLE_PERMISSION_ASSIGN", resource: "ROLE_PERMISSION", action: "ASSIGN", description: "Gán và thu hồi quyền của vai trò" },

  // Notifications & Emails
  { name: "NOTIFICATION_READ", resource: "NOTIFICATION", action: "READ", description: "Xem danh sách và lịch sử thông báo/email" },
  { name: "NOTIFICATION_CREATE", resource: "NOTIFICATION", action: "CREATE", description: "Tạo và gửi thông báo tới người dùng" },
  { name: "NOTIFICATION_UPDATE", resource: "NOTIFICATION", action: "UPDATE", description: "Kích hoạt retry gửi lại email bị lỗi" },
  { name: "NOTIFICATION_DELETE", resource: "NOTIFICATION", action: "DELETE", description: "Xóa thông báo và nhật ký email" },
  { name: "NOTIFICATION_TEMPLATE_READ", resource: "NOTIFICATION_TEMPLATE", action: "READ", description: "Xem mẫu thông báo và email" },
  { name: "NOTIFICATION_TEMPLATE_MANAGE", resource: "NOTIFICATION_TEMPLATE", action: "MANAGE", description: "Quản lý mẫu thông báo hệ thống" },
  { name: "NOTIFICATION_SETTING_READ", resource: "NOTIFICATION_SETTING", action: "READ", description: "Xem cài đặt thông báo cá nhân" },
  { name: "NOTIFICATION_SETTING_UPDATE", resource: "NOTIFICATION_SETTING", action: "UPDATE", description: "Cập nhật cài đặt nhận thông báo" },

  // Audit Logs
  { name: "AUDIT_LOG_READ", resource: "AUDIT_LOG", action: "READ", description: "Xem nhật ký kiểm toán hệ thống" },

  // System Maintenance
  { name: "MAINTENANCE_READ", resource: "MAINTENANCE", action: "READ", description: "Xem trạng thái bảo trì hệ thống" },
  { name: "MAINTENANCE_MANAGE", resource: "MAINTENANCE", action: "MANAGE", description: "Bật/tắt chế độ bảo trì hệ thống" },
  { name: "MAINTENANCE_BYPASS", resource: "MAINTENANCE", action: "BYPASS", description: "Truy cập hệ thống khi đang bảo trì" },

  // API Keys & Integrations
  { name: "API_KEY_READ", resource: "API_KEY", action: "READ", description: "Xem danh sách API Keys" },
  { name: "API_KEY_MANAGE", resource: "API_KEY", action: "MANAGE", description: "Tạo và quản lý API Keys" },
  { name: "WEBHOOK_READ", resource: "WEBHOOK", action: "READ", description: "Xem danh sách Webhooks" },
  { name: "WEBHOOK_MANAGE", resource: "WEBHOOK", action: "MANAGE", description: "Cấu hình và quản lý Webhooks" },

  // System Configuration & Feature Flags
  { name: "SYSTEM_CONFIG_READ", resource: "SYSTEM_CONFIG", action: "READ", description: "Xem cấu hình hệ thống và cờ tính năng" },
  { name: "SYSTEM_CONFIG_MANAGE", resource: "SYSTEM_CONFIG", action: "MANAGE", description: "Cập nhật cấu hình hệ thống" },

  // Scheduled / Cron Jobs Management
  { name: "CRON_JOB_READ", resource: "CRON_JOB", action: "READ", description: "Xem trạng thái các cron job nền" },
  { name: "CRON_JOB_MANAGE", resource: "CRON_JOB", action: "MANAGE", description: "Điều khiển và kích hoạt cron job thủ công" },

  // Departments & Positions
  { name: "DEPARTMENT_READ", resource: "DEPARTMENT", action: "READ", description: "Xem danh sách phòng ban" },
  { name: "DEPARTMENT_CREATE", resource: "DEPARTMENT", action: "CREATE", description: "Tạo phòng ban mới" },
  { name: "DEPARTMENT_UPDATE", resource: "DEPARTMENT", action: "UPDATE", description: "Cập nhật thông tin phòng ban" },
  { name: "DEPARTMENT_DELETE", resource: "DEPARTMENT", action: "DELETE", description: "Xóa mềm phòng ban" },
  { name: "POSITION_READ", resource: "POSITION", action: "READ", description: "Xem danh sách vị trí chuyên môn" },
  { name: "POSITION_CREATE", resource: "POSITION", action: "CREATE", description: "Tạo vị trí chuyên môn mới" },
  { name: "POSITION_UPDATE", resource: "POSITION", action: "UPDATE", description: "Cập nhật vị trí chuyên môn" },
  { name: "POSITION_DELETE", resource: "POSITION", action: "DELETE", description: "Xóa vị trí chuyên môn" },

  // Leaders
  { name: "LEADER_READ", resource: "LEADER", action: "READ", description: "Xem hồ sơ người hướng dẫn / quản lý" },
  { name: "LEADER_CREATE", resource: "LEADER", action: "CREATE", description: "Tạo hồ sơ người hướng dẫn mới" },
  { name: "LEADER_UPDATE", resource: "LEADER", action: "UPDATE", description: "Cập nhật thông tin người hướng dẫn" },
  { name: "LEADER_DELETE", resource: "LEADER", action: "DELETE", description: "Hủy hồ sơ người hướng dẫn" },

  // Interns
  { name: "INTERN_READ", resource: "INTERN", action: "READ", description: "Xem danh sách và hồ sơ thực tập sinh" },
  { name: "INTERN_CREATE", resource: "INTERN", action: "CREATE", description: "Tạo hồ sơ thực tập sinh mới" },
  { name: "INTERN_UPDATE", resource: "INTERN", action: "UPDATE", description: "Cập nhật tiến độ và hồ sơ thực tập sinh" },
  { name: "INTERN_DELETE", resource: "INTERN", action: "DELETE", description: "Xóa hoặc cho nghỉ ngang thực tập sinh" },
  { name: "INTERN_ASSIGN_LEADER", resource: "INTERN", action: "ASSIGN_LEADER", description: "Phân công người hướng dẫn cho thực tập sinh" },

  // Recruitment & Applications
  { name: "APPLICATION_READ", resource: "APPLICATION", action: "READ", description: "Xem danh sách và chi tiết đơn ứng tuyển" },
  { name: "APPLICATION_CREATE", resource: "APPLICATION", action: "CREATE", description: "Tạo đơn ứng tuyển thực tập" },
  { name: "APPLICATION_ASSIGN", resource: "APPLICATION", action: "ASSIGN", description: "Phân công phòng ban và vị trí cho đơn ứng tuyển" },
  { name: "APPLICATION_REVIEW", resource: "APPLICATION", action: "REVIEW", description: "Phê duyệt hoặc từ chối đơn ứng tuyển" },
  { name: "APPLICATION_DELETE", resource: "APPLICATION", action: "DELETE", description: "Xóa đơn ứng tuyển" },
  { name: "APPLICATION_INVITE_READ", resource: "APPLICATION_INVITE", action: "READ", description: "Xem thư mời nộp hồ sơ ứng tuyển" },
  { name: "APPLICATION_INVITE_CREATE", resource: "APPLICATION_INVITE", action: "CREATE", description: "Tạo thư mời ứng tuyển thực tập" },
  { name: "APPLICATION_INVITE_REVOKE", resource: "APPLICATION_INVITE", action: "REVOKE", description: "Thu hồi thư mời ứng tuyển" },

  // Task Groups
  { name: "TASK_GROUP_READ", resource: "TASK_GROUP", action: "READ", description: "Xem nhóm công việc dự án" },
  { name: "TASK_GROUP_CREATE", resource: "TASK_GROUP", action: "CREATE", description: "Tạo nhóm công việc mới" },
  { name: "TASK_GROUP_UPDATE", resource: "TASK_GROUP", action: "UPDATE", description: "Cập nhật nhóm công việc" },
  { name: "TASK_GROUP_DELETE", resource: "TASK_GROUP", action: "DELETE", description: "Xóa nhóm công việc" },

  // Tasks & Attachments
  { name: "TASK_READ", resource: "TASK", action: "READ", description: "Xem danh sách và chi tiết công việc" },
  { name: "TASK_CREATE", resource: "TASK", action: "CREATE", description: "Tạo công việc mới" },
  { name: "TASK_UPDATE", resource: "TASK", action: "UPDATE", description: "Cập nhật thông tin công việc" },
  { name: "TASK_DELETE", resource: "TASK", action: "DELETE", description: "Xóa công việc" },
  { name: "TASK_ATTACHMENT_UPLOAD", resource: "TASK", action: "UPLOAD_ATTACHMENT", description: "Tải lên tệp đính kèm công việc" },
  { name: "TASK_ATTACHMENT_DELETE", resource: "TASK", action: "DELETE_ATTACHMENT", description: "Xóa tệp đính kèm công việc" },

  // Task Assignments
  { name: "TASK_ASSIGNMENT_READ", resource: "TASK_ASSIGNMENT", action: "READ", description: "Xem phân công công việc" },
  { name: "TASK_ASSIGNMENT_CREATE", resource: "TASK_ASSIGNMENT", action: "CREATE", description: "Giao việc cho thực tập sinh" },
  { name: "TASK_ASSIGNMENT_UPDATE", resource: "TASK_ASSIGNMENT", action: "UPDATE", description: "Điều chỉnh phân công công việc" },
  { name: "TASK_ASSIGNMENT_DELETE", resource: "TASK_ASSIGNMENT", action: "DELETE", description: "Hủy phân công công việc" },
  { name: "TASK_ASSIGNMENT_APPROVE", resource: "TASK_ASSIGNMENT", action: "APPROVE", description: "Phê duyệt giao việc xuyên phòng ban" },

  // Task Submissions
  { name: "TASK_SUBMISSION_READ", resource: "TASK_SUBMISSION", action: "READ", description: "Xem bài nộp công việc" },
  { name: "TASK_SUBMISSION_CREATE", resource: "TASK_SUBMISSION", action: "CREATE", description: "Nộp bài làm công việc" },
  { name: "TASK_SUBMISSION_UPDATE", resource: "TASK_SUBMISSION", action: "UPDATE", description: "Cập nhật bài nộp công việc" },
  { name: "TASK_SUBMISSION_DELETE", resource: "TASK_SUBMISSION", action: "DELETE", description: "Xóa bài nộp công việc" },
  { name: "TASK_SUBMISSION_REVIEW", resource: "TASK_SUBMISSION", action: "REVIEW", description: "Đánh giá bài nộp công việc" },

  // Meetings
  { name: "MEETING_READ", resource: "MEETING", action: "READ", description: "Xem lịch họp và biên bản cuộc họp" },
  { name: "MEETING_CREATE", resource: "MEETING", action: "CREATE", description: "Tạo lịch họp mới" },
  { name: "MEETING_UPDATE", resource: "MEETING", action: "UPDATE", description: "Cập nhật lịch họp" },
  { name: "MEETING_DELETE", resource: "MEETING", action: "DELETE", description: "Hủy hoặc xóa cuộc họp" },
  { name: "MEETING_ATTEND", resource: "MEETING", action: "ATTEND", description: "Xác nhận tham gia và điểm danh họp" },
  { name: "MEETING_ABSENCE_SUBMIT", resource: "MEETING", action: "ABSENCE_SUBMIT", description: "Gửi yêu cầu vắng mặt cuộc họp" },
  { name: "MEETING_ABSENCE_REVIEW", resource: "MEETING", action: "ABSENCE_REVIEW", description: "Duyệt yêu cầu vắng mặt cuộc họp" },

  // Absences
  { name: "ABSENCE_READ", resource: "ABSENCE", action: "READ", description: "Xem đơn xin nghỉ phép" },
  { name: "ABSENCE_CREATE", resource: "ABSENCE", action: "CREATE", description: "Tạo đơn xin nghỉ phép" },
  { name: "ABSENCE_REVIEW", resource: "ABSENCE", action: "REVIEW", description: "Phê duyệt đơn xin nghỉ phép" },

  // Daily Reports
  { name: "DAILY_REPORT_READ", resource: "DAILY_REPORT", action: "READ", description: "Xem báo cáo tiến độ hằng ngày" },
  { name: "DAILY_REPORT_CREATE", resource: "DAILY_REPORT", action: "CREATE", description: "Nộp báo cáo tiến độ hằng ngày" },
  { name: "DAILY_REPORT_UPDATE", resource: "DAILY_REPORT", action: "UPDATE", description: "Cập nhật báo cáo tiến độ hằng ngày" },
  { name: "DAILY_REPORT_DELETE", resource: "DAILY_REPORT", action: "DELETE", description: "Xóa báo cáo tiến độ hằng ngày" },
  { name: "DAILY_REPORT_FEEDBACK", resource: "DAILY_REPORT", action: "FEEDBACK", description: "Phản hồi nhận xét báo cáo ngày" },

  // Weekly Evaluations
  { name: "WEEKLY_EVALUATION_READ", resource: "WEEKLY_EVALUATION", action: "READ", description: "Xem bảng đánh giá tiến độ tuần" },
  { name: "WEEKLY_EVALUATION_CREATE", resource: "WEEKLY_EVALUATION", action: "CREATE", description: "Tạo bảng đánh giá tuần 12 tiêu chí" },
  { name: "WEEKLY_EVALUATION_UPDATE", resource: "WEEKLY_EVALUATION", action: "UPDATE", description: "Cập nhật nhận xét và điểm đánh giá tuần" },
  { name: "WEEKLY_EVALUATION_DELETE", resource: "WEEKLY_EVALUATION", action: "DELETE", description: "Xóa bảng đánh giá tuần" },
  { name: "WEEKLY_EVALUATION_CONFIRM", resource: "WEEKLY_EVALUATION", action: "CONFIRM", description: "Xác nhận đã xem đánh giá tuần" },

  // Regulations & Policies
  { name: "REGULATION_READ", resource: "REGULATION", action: "READ", description: "Xem danh sách và chi tiết nội quy" },
  { name: "REGULATION_CREATE", resource: "REGULATION", action: "CREATE", description: "Tạo nội quy mới" },
  { name: "REGULATION_UPDATE", resource: "REGULATION", action: "UPDATE", description: "Cập nhật nội quy cơ quan" },
  { name: "REGULATION_DELETE", resource: "REGULATION", action: "DELETE", description: "Xóa nội quy cơ quan" },
  { name: "REGULATION_ACKNOWLEDGE", resource: "REGULATION", action: "ACKNOWLEDGE", description: "Xác nhận đã đọc và cam kết tuân thủ nội quy" },

  // Statistics & Dashboards
  { name: "STATS_ADMIN_READ", resource: "STATS", action: "ADMIN_READ", description: "Xem thống kê tổng quan toàn hệ thống" },
  { name: "STATS_LEADER_READ", resource: "STATS", action: "LEADER_READ", description: "Xem thống kê hiệu suất quản lý nhóm" },
  { name: "STATS_INTERN_READ", resource: "STATS", action: "INTERN_READ", description: "Xem thống kê tiến độ cá nhân thực tập sinh" },
];

// ── 2. Phân Quyền Theo Vai Trò (Role-Permission Matrix) ───────────────────────

const LEADER_PERMISSIONS: string[] = [
  "USER_READ",
  "DEPARTMENT_READ",
  "POSITION_READ",
  "LEADER_READ",
  "INTERN_READ",
  "INTERN_UPDATE",
  "INTERN_ASSIGN_LEADER",
  "APPLICATION_READ",
  "APPLICATION_REVIEW",
  "TASK_GROUP_READ",
  "TASK_GROUP_CREATE",
  "TASK_GROUP_UPDATE",
  "TASK_GROUP_DELETE",
  "TASK_READ",
  "TASK_CREATE",
  "TASK_UPDATE",
  "TASK_DELETE",
  "TASK_ATTACHMENT_UPLOAD",
  "TASK_ATTACHMENT_DELETE",
  "TASK_ASSIGNMENT_READ",
  "TASK_ASSIGNMENT_CREATE",
  "TASK_ASSIGNMENT_UPDATE",
  "TASK_ASSIGNMENT_DELETE",
  "TASK_ASSIGNMENT_APPROVE",
  "TASK_SUBMISSION_READ",
  "TASK_SUBMISSION_REVIEW",
  "MEETING_READ",
  "MEETING_CREATE",
  "MEETING_UPDATE",
  "MEETING_DELETE",
  "MEETING_ATTEND",
  "MEETING_ABSENCE_REVIEW",
  "ABSENCE_READ",
  "ABSENCE_REVIEW",
  "DAILY_REPORT_READ",
  "DAILY_REPORT_FEEDBACK",
  "WEEKLY_EVALUATION_READ",
  "WEEKLY_EVALUATION_CREATE",
  "WEEKLY_EVALUATION_UPDATE",
  "NOTIFICATION_READ",
  "NOTIFICATION_CREATE",
  "NOTIFICATION_SETTING_READ",
  "NOTIFICATION_SETTING_UPDATE",
  "NOTIFICATION_TEMPLATE_READ",
  "MAINTENANCE_READ",
  "AUDIT_LOG_READ",
  "REGULATION_READ",
  "REGULATION_ACKNOWLEDGE",
  "STATS_LEADER_READ",
  "STATS_INTERN_READ",
];

const INTERN_PERMISSIONS: string[] = [
  "DEPARTMENT_READ",
  "POSITION_READ",
  "TASK_GROUP_READ",
  "TASK_READ",
  "TASK_ASSIGNMENT_READ",
  "TASK_SUBMISSION_READ",
  "TASK_SUBMISSION_CREATE",
  "TASK_SUBMISSION_UPDATE",
  "TASK_SUBMISSION_DELETE",
  "MEETING_READ",
  "MEETING_ATTEND",
  "MEETING_ABSENCE_SUBMIT",
  "ABSENCE_READ",
  "ABSENCE_CREATE",
  "DAILY_REPORT_READ",
  "DAILY_REPORT_CREATE",
  "DAILY_REPORT_UPDATE",
  "WEEKLY_EVALUATION_READ",
  "WEEKLY_EVALUATION_CONFIRM",
  "NOTIFICATION_READ",
  "NOTIFICATION_SETTING_READ",
  "NOTIFICATION_SETTING_UPDATE",
  "REGULATION_READ",
  "REGULATION_ACKNOWLEDGE",
  "STATS_INTERN_READ",
];

const MANAGER_PERMISSIONS: string[] = [
  "USER_READ",
  "ROLE_READ",
  "PERMISSION_READ",
  "DEPARTMENT_READ",
  "POSITION_READ",
  "LEADER_READ",
  "INTERN_READ",
  "APPLICATION_READ",
  "TASK_GROUP_READ",
  "NOTIFICATION_READ",
  "NOTIFICATION_CREATE",
  "NOTIFICATION_UPDATE",
  "NOTIFICATION_TEMPLATE_READ",
  "MAINTENANCE_READ",
  "AUDIT_LOG_READ",
  "API_KEY_READ",
  "WEBHOOK_READ",
  "REGULATION_READ",
  "REGULATION_CREATE",
  "REGULATION_UPDATE",
  "STATS_ADMIN_READ",
  "STATS_LEADER_READ",
  "STATS_INTERN_READ",
];

const USER_BASE_PERMISSIONS: string[] = [
  "NOTIFICATION_READ",
  "NOTIFICATION_SETTING_READ",
  "NOTIFICATION_SETTING_UPDATE",
];

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
    console.error("CẢNH BÁO AN TOÀN: Không được phép chạy seed trên môi trường PRODUCTION mà không có cờ ALLOW_PROD_SEED=true!");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log("             BẮT ĐẦU KHỞI TẠO DỮ LIỆU CHUẨN NEXCAMPUS ENTERPRISE v2             ");
  console.log("================================================================================");

  // ── Phase 1: Phân Quyền Động (Dynamic RBAC) ───────────────────────────────
  console.log("\n[1/5] Khởi tạo Phân quyền động (Dynamic RBAC)...");

  const permissionMap: Record<string, string> = {};
  for (const perm of SYSTEM_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: true,
      },
      create: {
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: true,
      },
    });
    permissionMap[perm.name] = record.id;
  }
  console.log(`  ✓ Đã đồng bộ ${Object.keys(permissionMap).length} system permissions.`);

  const roles = [
    { name: "ADMIN", description: "Quản trị viên toàn quyền hệ thống", isSystem: true },
    { name: "LEADER", description: "Người hướng dẫn / Trưởng bộ phận chuyên môn", isSystem: true },
    { name: "INTERN", description: "Thực tập sinh cơ quan", isSystem: true },
    { name: "MANAGER", description: "Quản lý nhân sự & vận hành", isSystem: true },
    { name: "USER", description: "Người dùng cơ bản", isSystem: true },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        isSystem: r.isSystem,
      },
      create: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`  ✓ Đã khởi tạo ${Object.keys(roleMap).length} system roles: ${Object.keys(roleMap).join(", ")}.`);

  // Gán Role-Permission Matrix
  const rolePermissionAssignments: Record<string, string[]> = {
    ADMIN: SYSTEM_PERMISSIONS.map((p) => p.name),
    LEADER: LEADER_PERMISSIONS,
    INTERN: INTERN_PERMISSIONS,
    MANAGER: MANAGER_PERMISSIONS,
    USER: USER_BASE_PERMISSIONS,
  };

  const rolePermBatch: { roleId: string; permissionId: string }[] = [];
  for (const [roleName, permList] of Object.entries(rolePermissionAssignments)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const permName of permList) {
      const permissionId = permissionMap[permName];
      if (roleId && permissionId) {
        rolePermBatch.push({ roleId, permissionId });
      }
    }
  }
  if (rolePermBatch.length > 0) {
    await prisma.rolePermission.createMany({
      data: rolePermBatch,
      skipDuplicates: true,
    });
  }
  console.log("  ✓ Đã hoàn tất gán ma trận quyền hạn cho tất cả các vai trò hệ thống.");

  // ── Phase 2: Tài Khoản Mặc Định (Personas) ──────────────────────────────────
  console.log("\n[2/5] Khởi tạo Tài khoản mặc định...");

  const adminEmail = "admin@nexcampus.com";
  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin@123456", 10);
  const leaderPassword = await bcrypt.hash(process.env.SEED_LEADER_PASSWORD || "Leader@123456", 10);
  const internPassword = await bcrypt.hash(process.env.SEED_INTERN_PASSWORD || "Intern@123456", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: "NexCampus Administrator",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPassword,
      fullName: "NexCampus Administrator",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
  });

  await prisma.notificationSetting.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id },
  });
  console.log(`  ✓ Admin user: ${adminEmail} (Role: ADMIN, Active: true).`);

  // ── Phase 3: Cơ Cấu Tổ Chức Mẫu (Departments & Positions) ───────────────────
  console.log("\n[3/5] Khởi tạo Cơ cấu tổ chức mẫu (Departments & Positions)...");

  const orgData = [
    {
      name: "Kỹ thuật phần mềm (Software Engineering)",
      positions: [
        "Frontend Intern",
        "Backend Intern",
        "Fullstack Intern",
      ],
    },
    {
      name: "Kiểm thử chất lượng (QA/QC)",
      positions: [
        "QA Intern",
        "Automation Test Intern",
      ],
    },
    {
      name: "Thiết kế sản phẩm (UI/UX)",
      positions: [
        "UI/UX Intern",
        "Product Design Intern",
      ],
    },
  ];

  const deptMap: Record<string, string> = {};
  const posMap: Record<string, string> = {};

  for (const deptItem of orgData) {
    const dept = await prisma.department.upsert({
      where: { name: deptItem.name },
      update: {},
      create: { name: deptItem.name },
    });
    deptMap[deptItem.name] = dept.id;

    for (const posName of deptItem.positions) {
      let pos = await prisma.position.findFirst({
        where: { departmentId: dept.id, name: posName },
      });
      if (!pos) {
        pos = await prisma.position.create({
          data: { departmentId: dept.id, name: posName },
        });
      }
      posMap[`${deptItem.name}:${posName}`] = pos.id;
    }
  }
  console.log(`  ✓ Đã đồng bộ ${Object.keys(deptMap).length} phòng ban và ${Object.keys(posMap).length} vị trí thực tập.`);

  // Khởi tạo Leader mẫu & Intern mẫu để phục vụ demo / viva testing
  const leaderEmail = "leader@nexcampus.com";
  const leaderUser = await prisma.user.upsert({
    where: { email: leaderEmail },
    update: {
      fullName: "Đỗ Hoàng Long (Tech Lead)",
      roleId: roleMap["LEADER"],
      isActive: true,
    },
    create: {
      email: leaderEmail,
      password: leaderPassword,
      fullName: "Đỗ Hoàng Long (Tech Lead)",
      roleId: roleMap["LEADER"],
      isActive: true,
    },
  });

  await prisma.notificationSetting.upsert({
    where: { userId: leaderUser.id },
    update: {},
    create: { userId: leaderUser.id },
  });

  const leaderProfile = await prisma.leader.upsert({
    where: { userId: leaderUser.id },
    update: {
      position: "Tech Lead",
      phone: "0901234567",
    },
    create: {
      userId: leaderUser.id,
      position: "Tech Lead",
      phone: "0901234567",
    },
  });

  const seDeptId = deptMap["Kỹ thuật phần mềm (Software Engineering)"];
  if (seDeptId) {
    await prisma.leaderDepartment.upsert({
      where: {
        leaderId_departmentId: {
          leaderId: leaderProfile.id,
          departmentId: seDeptId,
        },
      },
      update: {},
      create: {
        leaderId: leaderProfile.id,
        departmentId: seDeptId,
      },
    });
  }
  console.log(`  ✓ Sample Leader: ${leaderEmail} (Phụ trách: Kỹ thuật phần mềm).`);

  const internEmail = "intern@nexcampus.com";
  const internUser = await prisma.user.upsert({
    where: { email: internEmail },
    update: {
      fullName: "Nguyễn Văn Thực Tập Sinh",
      roleId: roleMap["INTERN"],
      isActive: true,
    },
    create: {
      email: internEmail,
      password: internPassword,
      fullName: "Nguyễn Văn Thực Tập Sinh",
      roleId: roleMap["INTERN"],
      isActive: true,
    },
  });

  await prisma.notificationSetting.upsert({
    where: { userId: internUser.id },
    update: {},
    create: { userId: internUser.id },
  });

  const fePosId = posMap["Kỹ thuật phần mềm (Software Engineering):Frontend Intern"];
  await prisma.intern.upsert({
    where: { userId: internUser.id },
    update: {
      fullName: "Nguyễn Văn Thực Tập Sinh",
      phone: "0987654321",
      departmentId: seDeptId,
      positionId: fePosId,
      leaderId: leaderUser.id,
      status: "ACTIVE",
    },
    create: {
      userId: internUser.id,
      fullName: "Nguyễn Văn Thực Tập Sinh",
      phone: "0987654321",
      departmentId: seDeptId,
      positionId: fePosId,
      leaderId: leaderUser.id,
      startDate: new Date("2026-08-01"),
      duration: 3,
      status: "ACTIVE",
      university: "Đại học Bách Khoa",
      major: "Công nghệ thông tin",
    },
  });
  console.log(`  ✓ Sample Intern: ${internEmail} (Frontend Intern, Leader: ${leaderEmail}).`);

  // ── Phase 4: Cấu Hình Hệ Thống & Nội Quy (System Settings & Regulations) ─────
  console.log("\n[4/5] Khởi tạo Cấu hình hệ thống & Nội quy thực tập...");

  const systemSettings = [
    { key: "DAILY_REPORT_DEADLINE_TIME", value: "17:30", description: "Thời gian chốt nộp báo cáo ngày" },
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
  console.log(`  ✓ Đã thiết lập ${systemSettings.length} tham số cấu hình vận hành (System Settings).`);

  // Maintenance Config Default
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
  console.log("  ✓ Đã thiết lập cấu hình chế độ bảo trì (Maintenance Config: ONLINE).");

  // Quy định thực tập (Regulation)
  const defaultRegulationTitle = "Nội quy thực tập và Quy định bảo mật NexCampus 2026";
  const existingRegulation = await prisma.regulation.findFirst({
    where: { title: defaultRegulationTitle },
  });

  if (!existingRegulation) {
    await prisma.regulation.create({
      data: {
        title: defaultRegulationTitle,
        content: `
          <h3>QUY ĐỊNH CHUNG VÀ CAM KẾT BẢO MẬT DÀNH CHO THỰC TẬP SINH</h3>
          <p>Chào mừng bạn đã gia nhập chương trình thực tập công nghệ tại NexCampus. Mọi thực tập sinh phải tuân thủ nghiêm túc các điều khoản dưới đây:</p>
          <ol>
            <li><strong>Thời gian và kỷ luật làm việc:</strong> Tuân thủ đúng lịch làm việc đã đăng ký. Tham gia đầy đủ các cuộc họp nhóm và họp giao ban của bộ phận.</li>
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
    console.log("  ✓ Đã tạo mới Nội quy thực tập tiêu chuẩn.");
  } else {
    console.log("  ✓ Nội quy thực tập tiêu chuẩn đã tồn tại.");
  }

  // ── Phase 5: Mẫu Thông Báo Hệ Thống (Notification Templates) ────────────────
  console.log("\n[5/5] Khởi tạo Mẫu thông báo hệ thống (Notification Templates)...");

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
      code: "VERIFY_EMAIL",
      name: "Xác thực tài khoản",
      description: "Email gửi kèm liên kết kích hoạt khi người dùng đăng ký tài khoản mới",
      channels: ["EMAIL"],
      subject: "Xác thực tài khoản NexCampus của bạn",
      title: "Xác thực tài khoản",
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Cảm ơn bạn đã đăng ký tài khoản tại NexCampus. Vui lòng bấm vào liên kết bên dưới để xác thực địa chỉ email:</p><p><a href="{{verificationUrl}}" style="background-color:#4f46e5;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold;">Xác thực tài khoản ngay</a></p><p style="color:#666;font-size:12px;">Liên kết có hiệu lực trong 24 giờ.</p>',
      variables: ["fullName", "verificationUrl", "token"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "RESET_PASSWORD",
      name: "Đặt lại mật khẩu",
      description: "Email gửi mã token và đường dẫn thiết lập mật khẩu mới",
      channels: ["EMAIL"],
      subject: "Yêu cầu đặt lại mật khẩu tài khoản NexCampus",
      title: "Đặt lại mật khẩu",
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm vào nút bên dưới để tạo mật khẩu mới:</p><p><a href="{{resetUrl}}" style="background-color:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold;">Đặt lại mật khẩu</a></p><p style="color:#666;font-size:12px;">Liên kết có hiệu lực trong 1 giờ. Nếu không phải bạn yêu cầu, vui lòng bỏ qua thư này.</p>',
      variables: ["fullName", "resetUrl", "token"],
      isSystem: true,
      isActive: true,
    },
    {
      code: "SECURITY_ALERT",
      name: "Cảnh báo bảo mật đăng nhập lạ",
      description: "Thông báo khi phát hiện đăng nhập từ IP hoặc thiết bị mới",
      channels: ["WEB", "EMAIL"],
      subject: "⚠️ Cảnh báo bảo mật: Phát hiện đăng nhập từ thiết bị mới",
      title: "Phát hiện đăng nhập lạ",
      content: "Tài khoản của bạn vừa đăng nhập từ thiết bị: <strong>{{deviceName}}</strong> (IP: {{ipAddress}}) vào lúc <strong>{{loginTime}}</strong>.",
      variables: ["fullName", "deviceName", "ipAddress", "loginTime"],
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
  console.log(`  ✓ Đã đồng bộ ${NOTIFICATION_TEMPLATES.length} mẫu thông báo & email mặc định.`);

  console.log("\n================================================================================");
  console.log("            SEED DỮ LIỆU NEXCAMPUS v2 ĐÃ HOÀN TẤT THÀNH CÔNG VÀ AN TOÀN         ");
  console.log("================================================================================");
  console.log("Tài khoản quản trị & demo có sẵn:");
  console.log("  • ADMIN:  admin@nexcampus.com  / Admin@123456");
  console.log("  • LEADER: leader@nexcampus.com / Leader@123456");
  console.log("  • INTERN: intern@nexcampus.com / Intern@123456");
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
