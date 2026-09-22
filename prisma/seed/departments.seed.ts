import { PrismaClient } from "@prisma/client";

export interface SeedDepartmentsResult {
  deptMap: Record<string, string>;
  posMap: Record<string, string>;
}

export async function seedDepartments(prisma: PrismaClient): Promise<SeedDepartmentsResult> {
  console.log("\n[1/8] Khởi tạo Cơ cấu tổ chức (Departments & Positions)...");

  const orgData = [
    {
      name: "Kỹ thuật phần mềm (Software Engineering)",
      description: "Phát triển và bảo trì các hệ thống phần mềm, kiến trúc API và ứng dụng web/mobile.",
      positions: [
        "Frontend Intern",
        "Backend Intern",
        "Fullstack Intern",
        "DevOps Intern",
      ],
    },
    {
      name: "Kiểm thử chất lượng (QA/QC)",
      description: "Đảm bảo chất lượng hệ thống, viết kịch bản kiểm thử thủ công và tự động hóa.",
      positions: [
        "Manual QA Intern",
        "Automation Test Intern",
      ],
    },
    {
      name: "Thiết kế sản phẩm (UI/UX)",
      description: "Nghiên cứu hành vi người dùng, xây dựng Design System và thiết kế trải nghiệm sản phẩm.",
      positions: [
        "UI/UX Intern",
        "Graphic Design Intern",
      ],
    },
    {
      name: "Marketing & Truyền thông",
      description: "Lên kế hoạch phát triển nội dung, tối ưu SEO website và vận hành các chiến dịch truyền thông.",
      positions: [
        "Content Marketing Intern",
        "SEO Specialist Intern",
      ],
    },
    {
      name: "Nhân sự & Đào tạo (HR)",
      description: "Tuyển dụng, tiếp nhận hồ sơ, quản lý chế độ phúc lợi và tổ chức đào tạo thực tập sinh.",
      positions: [
        "Recruitment Intern",
        "HR Operations Intern",
      ],
    },
  ];

  const deptMap: Record<string, string> = {};
  const posMap: Record<string, string> = {};

  for (const deptItem of orgData) {
    const dept = await prisma.department.upsert({
      where: { name: deptItem.name },
      update: { description: deptItem.description },
      create: {
        name: deptItem.name,
        description: deptItem.description,
      },
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

  console.log(`   ✓ Đã tạo ${Object.keys(deptMap).length} phòng ban và ${Object.keys(posMap).length} vị trí thực tập.`);
  return { deptMap, posMap };
}
