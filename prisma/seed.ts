import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS = [
  // User Management
  { name: 'USER_READ', resource: 'USER', action: 'READ', description: 'Xem danh sách và chi tiết người dùng' },
  { name: 'USER_CREATE', resource: 'USER', action: 'CREATE', description: 'Tạo tài khoản người dùng mới' },
  { name: 'USER_UPDATE', resource: 'USER', action: 'UPDATE', description: 'Cập nhật trạng thái và thông tin người dùng' },
  { name: 'USER_DELETE', resource: 'USER', action: 'DELETE', description: 'Xóa mềm người dùng' },
  { name: 'USER_ROLE_ASSIGN', resource: 'USER', action: 'ASSIGN_ROLE', description: 'Phân vai trò cho người dùng' },

  // Role & Permission Management
  { name: 'ROLE_READ', resource: 'ROLE', action: 'READ', description: 'Xem danh sách vai trò và phân quyền' },
  { name: 'ROLE_CREATE', resource: 'ROLE', action: 'CREATE', description: 'Tạo vai trò mới' },
  { name: 'ROLE_UPDATE', resource: 'ROLE', action: 'UPDATE', description: 'Chỉnh sửa thông tin vai trò' },
  { name: 'ROLE_DELETE', resource: 'ROLE', action: 'DELETE', description: 'Xóa vai trò' },
  { name: 'PERMISSION_READ', resource: 'PERMISSION', action: 'READ', description: 'Xem danh mục quyền hệ thống' },
  { name: 'ROLE_PERMISSION_ASSIGN', resource: 'ROLE_PERMISSION', action: 'ASSIGN', description: 'Gán và thu hồi quyền của vai trò' },

  // Notifications & Emails
  { name: 'NOTIFICATION_READ', resource: 'NOTIFICATION', action: 'READ', description: 'Xem danh sách và lịch sử email/thông báo hệ thống' },
  { name: 'NOTIFICATION_CREATE', resource: 'NOTIFICATION', action: 'CREATE', description: 'Tạo và bắn thông báo tới người dùng / toàn hệ thống' },
  { name: 'NOTIFICATION_UPDATE', resource: 'NOTIFICATION', action: 'UPDATE', description: 'Kích hoạt retry gửi lại email bị lỗi' },
  { name: 'NOTIFICATION_DELETE', resource: 'NOTIFICATION', action: 'DELETE', description: 'Xóa thông báo và nhật ký email' },
  { name: 'NOTIFICATION_TEMPLATE_READ', resource: 'NOTIFICATION_TEMPLATE', action: 'READ', description: 'Xem danh sách và chi tiết mẫu thông báo/email' },
  { name: 'NOTIFICATION_TEMPLATE_MANAGE', resource: 'NOTIFICATION_TEMPLATE', action: 'MANAGE', description: 'Quản lý, tạo mới, cập nhật và test mẫu thông báo' },

  // Audit Logs
  { name: 'AUDIT_LOG_READ', resource: 'AUDIT_LOG', action: 'READ', description: 'Xem nhật ký kiểm toán hệ thống' },

  // System Maintenance
  { name: 'MAINTENANCE_READ', resource: 'MAINTENANCE', action: 'READ', description: 'Xem trạng thái và cấu hình bảo trì hệ thống' },
  { name: 'MAINTENANCE_MANAGE', resource: 'MAINTENANCE', action: 'MANAGE', description: 'Bật/tắt và quản lý lịch bảo trì hệ thống' },
  { name: 'MAINTENANCE_BYPASS', resource: 'MAINTENANCE', action: 'BYPASS', description: 'Truy cập hệ thống khi đang bật chế độ bảo trì' },

  // API Keys & Integrations
  { name: 'API_KEY_READ', resource: 'API_KEY', action: 'READ', description: 'Xem danh sách và chi tiết API Keys' },
  { name: 'API_KEY_MANAGE', resource: 'API_KEY', action: 'MANAGE', description: 'Tạo, thu hồi và quản lý API Keys' },

  // Webhooks
  { name: 'WEBHOOK_READ', resource: 'WEBHOOK', action: 'READ', description: 'Xem danh sách Webhook Endpoints và lịch sử giao nhận' },
  { name: 'WEBHOOK_MANAGE', resource: 'WEBHOOK', action: 'MANAGE', description: 'Đăng ký, cấu hình và kích hoạt retry Webhook deliveries' },
];

const USER_BASE_PERMISSIONS: string[] = [
  'NOTIFICATION_READ',
];

const MANAGER_PERMISSIONS: string[] = [
  'USER_READ',
  'ROLE_READ',
  'PERMISSION_READ',
  'NOTIFICATION_READ',
  'NOTIFICATION_CREATE',
  'NOTIFICATION_UPDATE',
  'NOTIFICATION_TEMPLATE_READ',
  'MAINTENANCE_READ',
  'AUDIT_LOG_READ',
  'API_KEY_READ',
  'WEBHOOK_READ',
];

async function main() {
  console.log('Starting Dynamic RBAC Seeding...');

  // 1. Seed Permissions
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
  console.log(`Upserted ${Object.keys(permissionMap).length} system permissions`);

  // 2. Seed System Roles
  const roles = [
    { name: 'ADMIN', description: 'Quản trị viên toàn quyền hệ thống', isSystem: true },
    { name: 'MANAGER', description: 'Quản lý tài chính và người dùng', isSystem: true },
    { name: 'USER', description: 'Người dùng thông thường', isSystem: true },
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
    console.log(`Role ${r.name} upserted with ID ${role.id}`);
  }

  // 3. Seed Role-Permissions Mapping
  const rolePermissionAssignments: Record<string, string[]> = {
    ADMIN: SYSTEM_PERMISSIONS.map((p) => p.name),
    MANAGER: MANAGER_PERMISSIONS,
    USER: USER_BASE_PERMISSIONS,
  };

  for (const [roleName, permList] of Object.entries(rolePermissionAssignments)) {
    const roleId = roleMap[roleName];
    for (const permName of permList) {
      const permissionId = permissionMap[permName];
      if (roleId && permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId,
          },
        });
      }
    }
    console.log(`Mapped ${permList.length} permissions to role ${roleName}`);
  }

  // 4. Seed Standard Users
  const adminEmail = 'admin@template.local';
  const adminPassword = await bcrypt.hash('Admin@123456', 10);

  const managerEmail = 'manager@template.local';
  const managerPassword = await bcrypt.hash('Manager@123456', 10);

  const userEmail = 'user@template.local';
  const userPassword = await bcrypt.hash('User@123456', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPassword,
      fullName: 'Admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPassword,
      fullName: 'Admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      password: managerPassword,
      fullName: 'Manager',
      roleId: roleMap['MANAGER'],
      isActive: true,
    },
    create: {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Manager',
      roleId: roleMap['MANAGER'],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      password: userPassword,
      fullName: 'User',
      roleId: roleMap['USER'],
      isActive: true,
    },
    create: {
      email: userEmail,
      password: userPassword,
      fullName: 'User',
      roleId: roleMap['USER'],
      isActive: true,
    },
  });

  // 5. Seed Default Maintenance Configuration
  await prisma.maintenanceConfig.upsert({
    where: { key: 'DEFAULT' },
    update: {},
    create: {
      key: 'DEFAULT',
      enabled: false,
      status: 'ONLINE',
      title: 'Hệ thống đang bảo trì',
      message: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.',
      bypassPermissions: ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'],
      bypassRoles: ['ADMIN'],
      bypassIps: [],
    },
  });
  console.log('MaintenanceConfig default seeded');

  // 6. Seed Default System Notification Templates
  const DEFAULT_TEMPLATES = [
    {
      code: 'VERIFY_EMAIL',
      name: 'Xác thực tài khoản',
      description: 'Email gửi kèm link xác thực khi người dùng đăng ký tài khoản mới',
      channels: ['EMAIL'],
      subject: 'Xác thực tài khoản của bạn',
      title: 'Xác thực tài khoản',
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào nút bên dưới để xác thực email của bạn:</p><div style="text-align: center; margin: 32px 0;"><a href="{{verificationUrl}}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xác thực tài khoản</a></div><p style="color: #666; font-size: 13px;">Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>',
      variables: ['fullName', 'verificationUrl', 'token'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'RESET_PASSWORD',
      name: 'Đặt lại mật khẩu',
      description: 'Email gửi kèm link khôi phục mật khẩu khi người dùng yêu cầu',
      channels: ['EMAIL'],
      subject: 'Đặt lại mật khẩu tài khoản',
      title: 'Đặt lại mật khẩu',
      content: '<p>Chào <strong>{{fullName}}</strong>,</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p><div style="text-align: center; margin: 32px 0;"><a href="{{resetUrl}}" style="background-color: #FF5722; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a></div><p style="color: #666; font-size: 13px;">Link có hiệu lực trong 1 giờ. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>',
      variables: ['fullName', 'resetUrl', 'token'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'NEW_DEVICE_ALERT',
      name: 'Cảnh báo đăng nhập thiết bị mới',
      description: 'Thông báo & Email khi phát hiện đăng nhập từ thiết bị lạ',
      channels: ['WEB', 'EMAIL'],
      subject: '⚠️ Cảnh báo: Phát hiện đăng nhập từ thiết bị mới',
      title: 'Phát hiện đăng nhập từ thiết bị mới',
      content: 'Tài khoản của bạn vừa được đăng nhập từ thiết bị: {{deviceName}} (IP: {{ipAddress}}) vào lúc {{loginTime}}.',
      variables: ['fullName', 'deviceName', 'ipAddress', 'loginTime'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'WELCOME',
      name: 'Chào mừng thành viên mới',
      description: 'Thông báo in-app chào mừng sau khi tài khoản được kích hoạt thành công',
      channels: ['WEB'],
      subject: 'Chào mừng bạn đến với hệ thống',
      title: 'Xác thực tài khoản thành công',
      content: 'Chào mừng {{fullName}} đến với hệ thống! Tài khoản của bạn đã được kích hoạt thành công.',
      variables: ['fullName'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'PASSWORD_CHANGED',
      name: 'Đổi mật khẩu thành công',
      description: 'Thông báo cảnh báo bảo mật khi mật khẩu tài khoản thay đổi',
      channels: ['WEB', 'EMAIL'],
      subject: 'Mật khẩu tài khoản đã được thay đổi',
      title: 'Đổi mật khẩu thành công',
      content: 'Mật khẩu tài khoản của bạn vừa được thay đổi thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ quản trị viên ngay lập tức.',
      variables: ['fullName'],
      isSystem: true,
      isActive: true,
    },
    {
      code: 'ROLE_ASSIGNED',
      name: 'Cập nhật vai trò tài khoản',
      description: 'Thông báo khi người dùng được gán vai trò mới',
      channels: ['WEB'],
      subject: 'Cập nhật vai trò tài khoản',
      title: 'Cập nhật vai trò tài khoản',
      content: 'Vai trò tài khoản của bạn đã được cập nhật thành: {{roleName}}.',
      variables: ['fullName', 'roleName'],
      isSystem: true,
      isActive: true,
    },
  ];

  for (const tpl of DEFAULT_TEMPLATES) {
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
  console.log('NotificationTemplates default seeded (6 templates)');

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
