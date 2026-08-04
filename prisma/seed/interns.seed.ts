import { PrismaClient, InternStatus } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedInterns(
  prisma: PrismaClient,
  internUsers: Record<string, string>,
  leaders: Record<string, string>,
  deptMap: Record<string, string>,
  posMap: Record<string, string>
): Promise<Record<string, string>> {
  console.log("-> Seeding Intern Profiles...");

  const data = [
    {
      email: "intern.a@nexcampus.local",
      fullName: "Nguyễn Văn Anh",
      phone: "0911111111",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh Backend",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.b@nexcampus.local",
      fullName: "Trần Thị Bình",
      phone: "0922222222",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh Frontend",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.c@nexcampus.local",
      fullName: "Lê Hoàng Long",
      phone: "0933333333",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh Mobile",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -120, // 4 tháng trước, kết thúc sau 3 tháng
      duration: 3,
      status: "COMPLETED" as InternStatus,
    },
    {
      email: "intern.d@nexcampus.local",
      fullName: "Phạm Quỳnh Chi",
      phone: "0944444444",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh DevOps",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -45,
      duration: 3,
      status: "DROPPED" as InternStatus,
    },
    {
      email: "intern.h@nexcampus.local",
      fullName: "Hoàng Văn Hùng",
      phone: "0988888881",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh Backend",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.i@nexcampus.local",
      fullName: "Đặng Thuỳ Linh",
      phone: "0988888882",
      deptName: "Kỹ thuật Công nghệ",
      posName: "Thực tập sinh Frontend",
      leaderEmail: "leader1@nexcampus.local",
      startOffsetDays: -7,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.e@nexcampus.local",
      fullName: "Vũ Minh Đức",
      phone: "0955555555",
      deptName: "Thiết kế Giao diện",
      posName: "Thực tập sinh UI/UX",
      leaderEmail: "leader2@nexcampus.local",
      startOffsetDays: -2,
      duration: 2,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.j@nexcampus.local",
      fullName: "Bùi Việt Hoàng",
      phone: "0988888883",
      deptName: "Thiết kế Giao diện",
      posName: "Thực tập sinh UI/UX",
      leaderEmail: "leader2@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.k@nexcampus.local",
      fullName: "Lý Minh Khuê",
      phone: "0988888884",
      deptName: "Thiết kế Giao diện",
      posName: "Thực tập sinh Graphic Design",
      leaderEmail: "leader2@nexcampus.local",
      startOffsetDays: -105,
      duration: 3,
      status: "COMPLETED" as InternStatus,
    },
    {
      email: "intern.f@nexcampus.local",
      fullName: "Hoàng Thu Trang",
      phone: "0966666666",
      deptName: "Marketing",
      posName: "Thực tập sinh Content",
      leaderEmail: "leader3@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.l@nexcampus.local",
      fullName: "Ngô Khánh Linh",
      phone: "0988888885",
      deptName: "Marketing",
      posName: "Thực tập sinh Content",
      leaderEmail: "leader3@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.m@nexcampus.local",
      fullName: "Phan Đức Mạnh",
      phone: "0988888886",
      deptName: "Marketing",
      posName: "Thực tập sinh SEO",
      leaderEmail: "leader3@nexcampus.local",
      startOffsetDays: -28,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.g@nexcampus.local",
      fullName: "Đỗ Nam Trung",
      phone: "0977777777",
      deptName: "Nhân sự",
      posName: "Thực tập sinh Recruiter",
      leaderEmail: "leader4@nexcampus.local",
      startOffsetDays: -14,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
    {
      email: "intern.n@nexcampus.local",
      fullName: "Trịnh Kim Ngân",
      phone: "0988888887",
      deptName: "Nhân sự",
      posName: "Thực tập sinh Recruiter",
      leaderEmail: "leader4@nexcampus.local",
      startOffsetDays: -14,
      duration: 3,
      status: "ACTIVE" as InternStatus,
    },
  ];

  const interns: Record<string, string> = {};

  for (const item of data) {
    const userId = internUsers[item.email];
    if (!userId) continue;

    const leaderId = item.leaderEmail ? leaders[item.leaderEmail] : null;
    const deptId = item.deptName ? deptMap[item.deptName] : null;
    const posId = item.posName ? posMap[item.posName] : null;

    const startOfInternship = getVnDate(item.startOffsetDays, 8, 0);

    const intern = await prisma.intern.upsert({
      where: { userId },
      update: {
        fullName: item.fullName,
        phone: item.phone,
        departmentId: deptId,
        positionId: posId,
        leaderId: leaderId,
        status: item.status,
        startDate: startOfInternship,
        duration: item.duration,
      },
      create: {
        userId,
        fullName: item.fullName,
        phone: item.phone,
        departmentId: deptId,
        positionId: posId,
        leaderId: leaderId,
        status: item.status,
        startDate: startOfInternship,
        duration: item.duration,
      },
    });

    interns[item.email] = intern.id;
  }

  console.log(`   ✓ Seeded ${Object.keys(interns).length} intern profiles.`);
  return interns;
}
