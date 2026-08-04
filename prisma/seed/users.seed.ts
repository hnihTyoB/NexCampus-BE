import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./helper";

export async function seedUsers(
  prisma: PrismaClient,
  deptMap: Record<string, string>
): Promise<{
  roleMap: Record<string, string>;
  leaders: Record<string, string>; // email -> user.id
  internUsers: Record<string, string>; // email -> user.id
}> {
  console.log("-> Seeding Roles & Users...");

  // 1. Seed Roles
  const roles = ["ADMIN", "LEADER", "INTERN"];
  const roleMap: Record<string, string> = {};

  for (const rName of roles) {
    const role = await prisma.role.upsert({
      where: { name: rName },
      update: {},
      create: { name: rName },
    });
    roleMap[rName] = role.id;
  }
  console.log("   ✓ Roles seeded.");

  // Passwords hashes
  const adminPass = await hashPassword("Admin@123456");
  const leaderPass = await hashPassword("Leader@123456");
  const internPass = await hashPassword("Intern@123456");

  // 2. Admin User
  await prisma.user.upsert({
    where: { email: "admin@nexcampus.local" },
    update: {
      password: adminPass,
      fullName: "System Admin",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
    create: {
      email: "admin@nexcampus.local",
      password: adminPass,
      fullName: "System Admin",
      roleId: roleMap["ADMIN"],
      isActive: true,
    },
  });
  console.log("   ✓ Admin user seeded.");

  // 3. 5 Leaders
  const leadersData = [
    {
      email: "leader1@nexcampus.local",
      fullName: "Đỗ Hoàng Long",
      position: "Tech Lead",
      phone: "0900000001",
      deptName: "Kỹ thuật Công nghệ",
    },
    {
      email: "leader2@nexcampus.local",
      fullName: "Nguyễn Thuỳ Chi",
      position: "Design Lead",
      phone: "0900000002",
      deptName: "Thiết kế Giao diện",
    },
    {
      email: "leader3@nexcampus.local",
      fullName: "Phạm Quốc Bảo",
      position: "Marketing Lead",
      phone: "0900000003",
      deptName: "Marketing",
    },
    {
      email: "leader4@nexcampus.local",
      fullName: "Trần Minh Tuyết",
      position: "HR Lead",
      phone: "0900000004",
      deptName: "Nhân sự",
    },
    {
      email: "leader5@nexcampus.local",
      fullName: "Lê Quang Hải",
      position: "Lead Advisor",
      phone: "0900000005",
      deptName: null, // Không quản lý phòng ban nào
    },
  ];

  const leaders: Record<string, string> = {};

  for (const l of leadersData) {
    const user = await prisma.user.upsert({
      where: { email: l.email },
      update: {
        password: leaderPass,
        fullName: l.fullName,
        roleId: roleMap["LEADER"],
        isActive: true,
      },
      create: {
        email: l.email,
        password: leaderPass,
        fullName: l.fullName,
        roleId: roleMap["LEADER"],
        isActive: true,
      },
    });
    leaders[l.email] = user.id;

    // Create Leader profile
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

    // Create LeaderDepartment link if deptName provided
    if (l.deptName && deptMap[l.deptName]) {
      const deptId = deptMap[l.deptName];
      
      // Xóa link LeaderDepartment cũ của Department này nếu có để giữ tính unique
      await prisma.leaderDepartment.deleteMany({
        where: { departmentId: deptId },
      });

      // Tạo mới
      await prisma.leaderDepartment.upsert({
        where: { departmentId: deptId },
        update: { leaderId: leaderProfile.id },
        create: {
          leaderId: leaderProfile.id,
          departmentId: deptId,
        },
      });
    }
  }
  console.log("   ✓ 5 Leaders and profiles seeded.");

  // 4. 14 Intern Users
  const internEmails = [
    "intern.a@nexcampus.local", "intern.b@nexcampus.local", "intern.c@nexcampus.local", "intern.d@nexcampus.local",
    "intern.h@nexcampus.local", "intern.i@nexcampus.local", "intern.e@nexcampus.local", "intern.j@nexcampus.local",
    "intern.k@nexcampus.local", "intern.f@nexcampus.local", "intern.l@nexcampus.local", "intern.m@nexcampus.local",
    "intern.g@nexcampus.local", "intern.n@nexcampus.local"
  ];

  const internFullNames: Record<string, string> = {
    "intern.a@nexcampus.local": "Nguyễn Văn Anh",
    "intern.b@nexcampus.local": "Trần Thị Bình",
    "intern.c@nexcampus.local": "Lê Hoàng Long",
    "intern.d@nexcampus.local": "Phạm Quỳnh Chi",
    "intern.h@nexcampus.local": "Hoàng Văn Hùng",
    "intern.i@nexcampus.local": "Đặng Thuỳ Linh",
    "intern.e@nexcampus.local": "Vũ Minh Đức",
    "intern.j@nexcampus.local": "Bùi Việt Hoàng",
    "intern.k@nexcampus.local": "Lý Minh Khuê",
    "intern.f@nexcampus.local": "Hoàng Thu Trang",
    "intern.l@nexcampus.local": "Ngô Khánh Linh",
    "intern.m@nexcampus.local": "Phan Đức Mạnh",
    "intern.g@nexcampus.local": "Đỗ Nam Trung",
    "intern.n@nexcampus.local": "Trịnh Kim Ngân",
  };

  const internUsers: Record<string, string> = {};

  for (const email of internEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: internPass,
        fullName: internFullNames[email],
        roleId: roleMap["INTERN"],
        isActive: true,
      },
      create: {
        email,
        password: internPass,
        fullName: internFullNames[email],
        roleId: roleMap["INTERN"],
        isActive: true,
      },
    });
    internUsers[email] = user.id;
  }
  console.log("   ✓ 14 Intern Users seeded.");

  return { roleMap, leaders, internUsers };
}
