import { PrismaClient, InternStatus } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedInterns(
  prisma: PrismaClient,
  internUsers: Record<string, string>,
  leaders: Record<string, string>,
  deptMap: Record<string, string>,
  posMap: Record<string, string>
): Promise<Record<string, string>> {
  console.log("\n[3/8] Khởi tạo Hồ sơ Thực tập sinh (Intern Profiles)...");

  const internsData = [
    {
      email: "intern@nexcampus.com",
      fullName: "Nguyễn Văn Thực Tập Sinh (Star Performer)",
      phone: "0911111111",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "Backend Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -52, // 2026-08-01
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0001",
      university: "Đại học Bách Khoa Hà Nội",
      major: "Công nghệ thông tin",
    },
    {
      email: "intern.b@nexcampus.com",
      fullName: "Trần Thị Bình (Struggling Intern)",
      phone: "0922222222",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "Frontend Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -52, // 2026-08-01
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0002",
      university: "Đại học Công nghệ - ĐHQGHN",
      major: "Kỹ thuật phần mềm",
    },
    {
      email: "intern.c@nexcampus.com",
      fullName: "Lê Hoàng Long (Completed Mobile Intern)",
      phone: "0933333333",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "Fullstack Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -144, // 2026-05-01
      duration: 3,
      status: InternStatus.COMPLETED,
      code: "INT-2026-0003",
      university: "Đại học FPT Hà Nội",
      major: "Kỹ thuật phần mềm",
    },
    {
      email: "intern.d@nexcampus.com",
      fullName: "Phạm Quỳnh Chi (Dropped DevOps Intern)",
      phone: "0944444444",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "DevOps Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -52, // 2026-08-01
      duration: 3,
      status: InternStatus.DROPPED,
      code: "INT-2026-0004",
      university: "Đại học Kinh tế Quốc dân",
      major: "Hệ thống thông tin quản lý",
    },
    {
      email: "intern.e@nexcampus.com",
      fullName: "Vũ Minh Đức (New Joiner UI/UX)",
      phone: "0955555555",
      deptName: "Thiết kế sản phẩm (UI/UX)",
      posName: "UI/UX Intern",
      leaderEmail: "leader.design@nexcampus.com",
      startOffsetDays: -2, // 2026-09-20 (Mới vào)
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0005",
      university: "Đại học Mỹ thuật Công nghiệp",
      major: "Thiết kế đồ họa",
    },
    {
      email: "intern.f@nexcampus.com",
      fullName: "Hoàng Thu Trang (Average QA Intern)",
      phone: "0966666666",
      deptName: "Kiểm thử chất lượng (QA/QC)",
      posName: "Manual QA Intern",
      leaderEmail: "leader.qa@nexcampus.com",
      startOffsetDays: -52, // 2026-08-01
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0006",
      university: "Học viện Công nghệ Bưu chính Viễn thông",
      major: "An toàn thông tin",
    },
    {
      email: "intern.g@nexcampus.com",
      fullName: "Đỗ Nam Trung (Blocked Backend Intern)",
      phone: "0977777777",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "Backend Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -38, // 2026-08-15
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0007",
      university: "Đại học Giao thông Vận tải",
      major: "Khoa học máy tính",
    },
    {
      email: "intern.h@nexcampus.com",
      fullName: "Hoàng Văn Hùng (Automation QA)",
      phone: "0988888881",
      deptName: "Kiểm thử chất lượng (QA/QC)",
      posName: "Automation Test Intern",
      leaderEmail: "leader.qa@nexcampus.com",
      startOffsetDays: -52,
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0008",
      university: "Đại học Xây dựng Hà Nội",
      major: "Công nghệ thông tin",
    },
    {
      email: "intern.i@nexcampus.com",
      fullName: "Đặng Thuỳ Linh (Junior Frontend)",
      phone: "0988888882",
      deptName: "Kỹ thuật phần mềm (Software Engineering)",
      posName: "Frontend Intern",
      leaderEmail: "leader@nexcampus.com",
      startOffsetDays: -8, // 2026-09-14 (1 tuần trước)
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0009",
      university: "Đại học Kiến trúc Hà Nội",
      major: "Thiết kế đa phương tiện",
    },
    {
      email: "intern.j@nexcampus.com",
      fullName: "Bùi Việt Hoàng (Design System UI/UX)",
      phone: "0988888883",
      deptName: "Thiết kế sản phẩm (UI/UX)",
      posName: "UI/UX Intern",
      leaderEmail: "leader.design@nexcampus.com",
      startOffsetDays: -52,
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0010",
      university: "Đại học Thương Mại",
      major: "Thương mại điện tử",
    },
    {
      email: "intern.k@nexcampus.com",
      fullName: "Lý Minh Khuê (Completed Graphic Design)",
      phone: "0988888884",
      deptName: "Thiết kế sản phẩm (UI/UX)",
      posName: "Graphic Design Intern",
      leaderEmail: "leader.design@nexcampus.com",
      startOffsetDays: -130,
      duration: 3,
      status: InternStatus.COMPLETED,
      code: "INT-2026-0011",
      university: "Đại học Hà Nội",
      major: "Ngôn ngữ & Truyền thông",
    },
    {
      email: "intern.l@nexcampus.com",
      fullName: "Ngô Khánh Linh (Content Marketing)",
      phone: "0988888885",
      deptName: "Marketing & Truyền thông",
      posName: "Content Marketing Intern",
      leaderEmail: "leader.mkt@nexcampus.com",
      startOffsetDays: -52,
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0012",
      university: "Đại học Ngoại Thương",
      major: "Marketing & Kinh doanh Quốc tế",
    },
    {
      email: "intern.m@nexcampus.com",
      fullName: "Phan Đức Mạnh (SEO Specialist)",
      phone: "0988888886",
      deptName: "Marketing & Truyền thông",
      posName: "SEO Specialist Intern",
      leaderEmail: "leader.mkt@nexcampus.com",
      startOffsetDays: -52,
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0013",
      university: "Đại học Mở Hà Nội",
      major: "Quản trị Kinh doanh",
    },
    {
      email: "intern.n@nexcampus.com",
      fullName: "Trịnh Kim Ngân (HR Recruiter)",
      phone: "0988888887",
      deptName: "Nhân sự & Đào tạo (HR)",
      posName: "Recruitment Intern",
      leaderEmail: "leader.hr@nexcampus.com",
      startOffsetDays: -21, // 2026-09-01
      duration: 3,
      status: InternStatus.ACTIVE,
      code: "INT-2026-0014",
      university: "Đại học Sư phạm Hà Nội",
      major: "Quản lý Giáo dục & Nhân sự",
    },
  ];

  const interns: Record<string, string> = {};

  for (const item of internsData) {
    const userId = internUsers[item.email];
    if (!userId) continue;

    const leaderUserId = item.leaderEmail ? leaders[item.leaderEmail] : null;
    const deptId = item.deptName ? deptMap[item.deptName] : null;
    const posId = (item.deptName && item.posName) ? posMap[`${item.deptName}:${item.posName}`] : null;
    const startDate = getVnDate(item.startOffsetDays, 8, 0);

    const intern = await prisma.intern.upsert({
      where: { userId },
      update: {
        fullName: item.fullName,
        phone: item.phone,
        departmentId: deptId,
        positionId: posId,
        leaderId: leaderUserId,
        status: item.status,
        startDate,
        duration: item.duration,
        internCode: item.code,
        university: item.university,
        major: item.major,
      },
      create: {
        userId,
        fullName: item.fullName,
        phone: item.phone,
        departmentId: deptId,
        positionId: posId,
        leaderId: leaderUserId,
        status: item.status,
        startDate,
        duration: item.duration,
        internCode: item.code,
        university: item.university,
        major: item.major,
      },
    });

    interns[item.email] = intern.id;
  }

  console.log(`   ✓ Đã tạo ${Object.keys(interns).length} hồ sơ thực tập sinh đầy đủ.`);
  return interns;
}
