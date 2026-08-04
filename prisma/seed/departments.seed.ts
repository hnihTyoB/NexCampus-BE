import { PrismaClient } from "@prisma/client";

export async function seedDepartments(prisma: PrismaClient): Promise<{
  deptMap: Record<string, string>;
  posMap: Record<string, string>;
}> {
  console.log("-> Seeding Departments & Positions...");

  const data = [
    {
      name: "Kỹ thuật Công nghệ",
      positions: ["Thực tập sinh Backend", "Thực tập sinh Frontend", "Thực tập sinh Mobile", "Thực tập sinh DevOps"],
    },
    {
      name: "Thiết kế Giao diện",
      positions: ["Thực tập sinh UI/UX", "Thực tập sinh Graphic Design"],
    },
    {
      name: "Marketing",
      positions: ["Thực tập sinh Content", "Thực tập sinh SEO"],
    },
    {
      name: "Nhân sự",
      positions: ["Thực tập sinh Recruiter"],
    },
  ];

  const deptMap: Record<string, string> = {};
  const posMap: Record<string, string> = {};

  for (const item of data) {
    const dept = await prisma.department.upsert({
      where: { name: item.name },
      update: {},
      create: { name: item.name },
    });
    deptMap[item.name] = dept.id;

    for (const posName of item.positions) {
      // Vì Position không có unique constraint name toàn cục (chỉ có departmentId + name hoặc không unique),
      // nên ta tìm kiếm xem đã có chưa, nếu chưa có thì create.
      let pos = await prisma.position.findFirst({
        where: { departmentId: dept.id, name: posName },
      });
      if (!pos) {
        pos = await prisma.position.create({
          data: { departmentId: dept.id, name: posName },
        });
      }
      posMap[posName] = pos.id;
    }
  }

  console.log(`   ✓ Seeded ${data.length} departments.`);
  return { deptMap, posMap };
}
