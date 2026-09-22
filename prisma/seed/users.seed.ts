import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./helper";

export interface SeedUsersResult {
  roleMap: Record<string, string>;
  permissionMap: Record<string, string>;
  adminUser: { id: string; email: string };
  managerUser: { id: string; email: string };
  leaders: Record<string, string>; // email -> userId
  leaderProfiles: Record<string, string>; // email -> leaderId
  internUsers: Record<string, string>; // email -> userId
}

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

  // PDF Export
  { name: "PDF_EXPORT_SUMMARY", resource: "PDF_EXPORT", action: "SUMMARY", description: "Xuất bảng tổng hợp kết quả thực tập (PDF)" },
  { name: "PDF_EXPORT_WEEKLY_EVALUATION", resource: "PDF_EXPORT", action: "WEEKLY_EVALUATION", description: "Xuất phiếu đánh giá tuần (PDF)" },
];

const LEADER_PERMISSIONS: string[] = [
  "USER_READ", "DEPARTMENT_READ", "POSITION_READ", "LEADER_READ", "INTERN_READ", "INTERN_UPDATE",
  "INTERN_ASSIGN_LEADER", "APPLICATION_READ", "APPLICATION_REVIEW", "TASK_GROUP_READ", "TASK_GROUP_CREATE",
  "TASK_GROUP_UPDATE", "TASK_GROUP_DELETE", "TASK_READ", "TASK_CREATE", "TASK_UPDATE", "TASK_DELETE",
  "TASK_ATTACHMENT_UPLOAD", "TASK_ATTACHMENT_DELETE", "TASK_ASSIGNMENT_READ", "TASK_ASSIGNMENT_CREATE",
  "TASK_ASSIGNMENT_UPDATE", "TASK_ASSIGNMENT_DELETE", "TASK_ASSIGNMENT_APPROVE", "TASK_SUBMISSION_READ",
  "TASK_SUBMISSION_REVIEW", "MEETING_READ", "MEETING_CREATE", "MEETING_UPDATE", "MEETING_DELETE",
  "MEETING_ATTEND", "MEETING_ABSENCE_REVIEW", "DAILY_REPORT_READ",
  "DAILY_REPORT_FEEDBACK", "WEEKLY_EVALUATION_READ", "WEEKLY_EVALUATION_CREATE", "WEEKLY_EVALUATION_UPDATE",
  "NOTIFICATION_READ", "NOTIFICATION_CREATE", "NOTIFICATION_SETTING_READ", "NOTIFICATION_SETTING_UPDATE",
  "NOTIFICATION_TEMPLATE_READ", "MAINTENANCE_READ", "AUDIT_LOG_READ", "REGULATION_READ", "REGULATION_ACKNOWLEDGE",
  "STATS_LEADER_READ", "STATS_INTERN_READ", "PDF_EXPORT_SUMMARY", "PDF_EXPORT_WEEKLY_EVALUATION",
];

const INTERN_PERMISSIONS: string[] = [
  "DEPARTMENT_READ", "POSITION_READ", "TASK_GROUP_READ", "TASK_READ", "TASK_ASSIGNMENT_READ",
  "TASK_SUBMISSION_READ", "TASK_SUBMISSION_CREATE", "TASK_SUBMISSION_UPDATE", "TASK_SUBMISSION_DELETE",
  "MEETING_READ", "MEETING_ATTEND", "MEETING_ABSENCE_SUBMIT",
  "DAILY_REPORT_READ", "DAILY_REPORT_CREATE", "DAILY_REPORT_UPDATE", "WEEKLY_EVALUATION_READ",
  "WEEKLY_EVALUATION_CONFIRM", "NOTIFICATION_READ", "NOTIFICATION_SETTING_READ", "NOTIFICATION_SETTING_UPDATE",
  "REGULATION_READ", "REGULATION_ACKNOWLEDGE", "STATS_INTERN_READ", "PDF_EXPORT_WEEKLY_EVALUATION",
];

const MANAGER_PERMISSIONS: string[] = [
  "USER_READ", "ROLE_READ", "PERMISSION_READ", "DEPARTMENT_READ", "POSITION_READ", "LEADER_READ",
  "INTERN_READ", "APPLICATION_READ", "TASK_GROUP_READ", "NOTIFICATION_READ", "NOTIFICATION_CREATE",
  "NOTIFICATION_UPDATE", "NOTIFICATION_TEMPLATE_READ", "MAINTENANCE_READ", "AUDIT_LOG_READ",
  "API_KEY_READ", "WEBHOOK_READ", "REGULATION_READ", "REGULATION_CREATE", "REGULATION_UPDATE",
  "STATS_ADMIN_READ", "STATS_LEADER_READ", "STATS_INTERN_READ",
];

const USER_BASE_PERMISSIONS: string[] = [
  "NOTIFICATION_READ", "NOTIFICATION_SETTING_READ", "NOTIFICATION_SETTING_UPDATE",
];

export async function seedUsers(
  prisma: PrismaClient,
  deptMap: Record<string, string>
): Promise<SeedUsersResult> {
  console.log("\n[2/8] Khởi tạo Dynamic RBAC & Tài khoản người dùng...");

  // 1. Permissions
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
  console.log(`   ✓ Đã đồng bộ ${Object.keys(permissionMap).length} Permissions.`);

  // 2. Roles
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
      update: { description: r.description, isSystem: r.isSystem },
      create: { name: r.name, description: r.description, isSystem: r.isSystem },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`   ✓ Đã đồng bộ ${Object.keys(roleMap).length} System Roles.`);

  // 3. Role-Permission Matrix
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
  console.log("   ✓ Đã gán ma trận quyền hạn cho tất cả các vai trò.");

  // Password Hashes
  const adminPassword = await hashPassword("Admin@123456");
  const managerPassword = await hashPassword("Manager@123456");
  const leaderPassword = await hashPassword("Leader@123456");
  const internPassword = await hashPassword("Intern@123456");

  // Helper create NotificationSetting
  async function ensureNotificationSetting(userId: string) {
    await prisma.notificationSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  // 4. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@nexcampus.com" },
    update: {
      fullName: "NexCampus Administrator",
      phoneNumber: "0900000000",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
    create: {
      email: "admin@nexcampus.com",
      password: adminPassword,
      fullName: "NexCampus Administrator",
      phoneNumber: "0900000000",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
  });
  await ensureNotificationSetting(adminUser.id);
  console.log("   ✓ Admin: admin@nexcampus.com / Admin@123456");

  // 5. Manager User
  const managerUser = await prisma.user.upsert({
    where: { email: "manager@nexcampus.com" },
    update: {
      fullName: "Trần Thị Quản Lý",
      phoneNumber: "0900000099",
      roleId: roleMap["MANAGER"],
      isActive: true,
    },
    create: {
      email: "manager@nexcampus.com",
      password: managerPassword,
      fullName: "Trần Thị Quản Lý",
      phoneNumber: "0900000099",
      roleId: roleMap["MANAGER"],
      isActive: true,
    },
  });
  await ensureNotificationSetting(managerUser.id);
  console.log("   ✓ Manager: manager@nexcampus.com / Manager@123456");

  // 6. 5 Leaders with Departments
  const leadersData = [
    {
      email: "leader@nexcampus.com",
      fullName: "Đỗ Hoàng Long (Tech Lead)",
      position: "Tech Lead",
      phone: "0901234567",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
    },
    {
      email: "leader.qa@nexcampus.com",
      fullName: "Nguyễn Thuỳ Chi (QA Lead)",
      position: "QA Lead",
      phone: "0901234568",
      deptName: "Kiểm thử chất lượng (QA/QC)",
    },
    {
      email: "leader.design@nexcampus.com",
      fullName: "Phạm Quốc Bảo (Design Lead)",
      position: "Design Lead",
      phone: "0901234569",
      deptName: "Thiết kế sản phẩm (UI/UX)",
    },
    {
      email: "leader.mkt@nexcampus.com",
      fullName: "Trần Minh Tuyết (Marketing Lead)",
      position: "Marketing Lead",
      phone: "0901234570",
      deptName: "Marketing & Truyền thông",
    },
    {
      email: "leader.hr@nexcampus.com",
      fullName: "Lê Quang Hải (HR Lead)",
      position: "HR Lead",
      phone: "0901234571",
      deptName: "Nhân sự & Đào tạo (HR)",
    },
  ];

  const leaders: Record<string, string> = {};
  const leaderProfiles: Record<string, string> = {};

  for (const l of leadersData) {
    const user = await prisma.user.upsert({
      where: { email: l.email },
      update: {
        fullName: l.fullName,
        phoneNumber: l.phone,
        roleId: roleMap["LEADER"],
        isActive: true,
      },
      create: {
        email: l.email,
        password: leaderPassword,
        fullName: l.fullName,
        phoneNumber: l.phone,
        roleId: roleMap["LEADER"],
        isActive: true,
      },
    });
    leaders[l.email] = user.id;
    await ensureNotificationSetting(user.id);

    const leaderProfile = await prisma.leader.upsert({
      where: { userId: user.id },
      update: {
        position: l.position,
        phone: l.phone,
      },
      create: {
        userId: user.id,
        position: l.position,
        phone: l.phone,
      },
    });
    leaderProfiles[l.email] = leaderProfile.id;

    if (l.deptName && deptMap[l.deptName]) {
      const deptId = deptMap[l.deptName];
      await prisma.leaderDepartment.upsert({
        where: {
          leaderId_departmentId: {
            leaderId: leaderProfile.id,
            departmentId: deptId,
          },
        },
        update: {},
        create: {
          leaderId: leaderProfile.id,
          departmentId: deptId,
        },
      });
    }
  }
  console.log(`   ✓ Đã tạo ${Object.keys(leaders).length} Leaders (Mật khẩu: Leader@123456).`);

  // 7. 14 Intern Users
  const internUsersData = [
    { email: "intern@nexcampus.com", fullName: "Nguyễn Văn Thực Tập Sinh (Star Performer)", phone: "0911111111" },
    { email: "intern.b@nexcampus.com", fullName: "Trần Thị Bình (Struggling Intern)", phone: "0922222222" },
    { email: "intern.c@nexcampus.com", fullName: "Lê Hoàng Long (Completed Mobile Intern)", phone: "0933333333" },
    { email: "intern.d@nexcampus.com", fullName: "Phạm Quỳnh Chi (Dropped DevOps Intern)", phone: "0944444444" },
    { email: "intern.e@nexcampus.com", fullName: "Vũ Minh Đức (New Joiner UI/UX)", phone: "0955555555" },
    { email: "intern.f@nexcampus.com", fullName: "Hoàng Thu Trang (Average QA Intern)", phone: "0966666666" },
    { email: "intern.g@nexcampus.com", fullName: "Đỗ Nam Trung (Blocked Backend Intern)", phone: "0977777777" },
    { email: "intern.h@nexcampus.com", fullName: "Hoàng Văn Hùng (Automation QA)", phone: "0988888881" },
    { email: "intern.i@nexcampus.com", fullName: "Đặng Thuỳ Linh (Junior Frontend)", phone: "0988888882" },
    { email: "intern.j@nexcampus.com", fullName: "Bùi Việt Hoàng (Design System UI/UX)", phone: "0988888883" },
    { email: "intern.k@nexcampus.com", fullName: "Lý Minh Khuê (Completed Graphic Design)", phone: "0988888884" },
    { email: "intern.l@nexcampus.com", fullName: "Ngô Khánh Linh (Content Marketing)", phone: "0988888885" },
    { email: "intern.m@nexcampus.com", fullName: "Phan Đức Mạnh (SEO Specialist)", phone: "0988888886" },
    { email: "intern.n@nexcampus.com", fullName: "Trịnh Kim Ngân (HR Recruiter)", phone: "0988888887" },
  ];

  const internUsers: Record<string, string> = {};

  for (const iu of internUsersData) {
    const user = await prisma.user.upsert({
      where: { email: iu.email },
      update: {
        fullName: iu.fullName,
        phoneNumber: iu.phone,
        roleId: roleMap["INTERN"],
        isActive: true,
      },
      create: {
        email: iu.email,
        password: internPassword,
        fullName: iu.fullName,
        phoneNumber: iu.phone,
        roleId: roleMap["INTERN"],
        isActive: true,
      },
    });
    internUsers[iu.email] = user.id;
    await ensureNotificationSetting(user.id);
  }
  console.log(`   ✓ Đã tạo ${Object.keys(internUsers).length} Intern Users (Mật khẩu: Intern@123456).`);

  return {
    roleMap,
    permissionMap,
    adminUser: { id: adminUser.id, email: adminUser.email! },
    managerUser: { id: managerUser.id, email: managerUser.email! },
    leaders,
    leaderProfiles,
    internUsers,
  };
}
