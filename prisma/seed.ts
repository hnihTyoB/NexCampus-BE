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

  // Audit Logs
  { name: 'AUDIT_LOG_READ', resource: 'AUDIT_LOG', action: 'READ', description: 'Xem nhật ký kiểm toán hệ thống' },

  // System Maintenance
  { name: 'MAINTENANCE_READ', resource: 'MAINTENANCE', action: 'READ', description: 'Xem trạng thái và cấu hình bảo trì hệ thống' },
  { name: 'MAINTENANCE_MANAGE', resource: 'MAINTENANCE', action: 'MANAGE', description: 'Bật/tắt và quản lý lịch bảo trì hệ thống' },
  { name: 'MAINTENANCE_BYPASS', resource: 'MAINTENANCE', action: 'BYPASS', description: 'Truy cập hệ thống khi đang bật chế độ bảo trì' },
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
  'MAINTENANCE_READ',
  'AUDIT_LOG_READ',
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
    },
  });
  console.log('MaintenanceConfig default seeded');

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
