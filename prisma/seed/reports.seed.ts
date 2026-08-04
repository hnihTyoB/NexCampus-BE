import { PrismaClient } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedReports(
  prisma: PrismaClient,
  interns: Record<string, string> // email -> intern.id
): Promise<void> {
  console.log("-> Seeding Daily Reports...");

  const contentPool: Record<string, string[]> = {
    Backend: [
      "Tìm hiểu cấu trúc thư mục dự án Express/NestJS và kết nối database.",
      "Viết API CRUD cho module quản lý người dùng và phân quyền truy cập.",
      "Tối ưu hoá các truy vấn SQL và tạo thêm index để tăng tốc độ tìm kiếm.",
      "Tích hợp thư viện Redis để cache các dữ liệu ít thay đổi.",
      "Viết unit test cho service và repository của module authentication.",
      "Xử lý lỗi SQL injection và cập nhật bảo mật cho các API public.",
      "Refactor code, tách biệt business logic ra khỏi controller.",
      "Nghiên cứu và thử nghiệm triển khai Docker container cho backend.",
    ],
    Frontend: [
      "Dựng giao diện khung cho trang Dashboard Admin sử dụng Tailwind CSS.",
      "Validate form đăng ký bằng React Hook Form kết hợp với Zod schema.",
      "Tích hợp API đăng nhập và lưu token vào LocalStorage/Cookie.",
      "Sửa lỗi hiển thị UI bị vỡ trên các thiết bị màn hình nhỏ (responsive).",
      "Viết component reusable như Button, Input, Modal cho Design System.",
      "Tối ưu tốc độ tải trang bằng cách lazy load ảnh và tối ưu bundle size.",
      "Tích hợp React Query để quản lý server state và tự động cache dữ liệu.",
      "Tìm hiểu và áp dụng Framer Motion để tạo các hiệu ứng chuyển động mượt mà.",
    ],
    "UI/UX": [
      "Nghiên cứu trải nghiệm người dùng và vẽ wireframe cho luồng onboarding.",
      "Thiết kế Hi-Fi Mockup cho màn hình quản lý công việc trên Figma.",
      "Tạo prototype liên kết các màn hình để demo luồng cho khách hàng.",
      "Phỏng vấn thử nghiệm người dùng thực tế và ghi chép lại các điểm đau (pain points).",
      "Phân tích UI/UX của 3 đối thủ cạnh tranh lớn trên thị trường.",
      "Xây dựng thư viện component UI tĩnh (Color palette, Typography, Grid).",
    ],
    Marketing: [
      "Lên kế hoạch nội dung tuần mới cho kênh Facebook và LinkedIn.",
      "Viết bài content chi tiết giới thiệu về tính năng mới của dự án.",
      "Nghiên cứu bộ từ khoá SEO mảng giáo dục công nghệ để viết bài.",
      "Viết kịch bản chi tiết cho video TikTok hướng nghiệp thực tập sinh.",
      "Phân tích lượng truy cập (traffic) website tuần qua qua Google Analytics.",
      "Chỉnh sửa hình ảnh và thiết kế infographic chia sẻ kiến thức.",
    ],
    HR: [
      "Nghiên cứu quy chế thực tập và quy trình tuyển dụng onboarding của công ty.",
      "Sàng lọc hồ sơ ứng viên vị trí Frontend Intern trên LinkedIn và TopCV.",
      "Liên hệ qua email và gọi điện hẹn lịch phỏng vấn sơ loại cho 5 ứng viên.",
      "Chuẩn bị tài liệu câu hỏi phỏng vấn chuyên môn cho Mentor.",
      "Cập nhật trạng thái ứng viên lên file quản lý chung (ATS).",
      "Hỗ trợ chuẩn bị chỗ ngồi và tài liệu onboarding cho Intern mới vào.",
    ],
  };

  const config = [
    {
      email: "intern.a@nexcampus.local",
      deptType: "Backend",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.0, // 100% đúng giờ
      missingChance: 0.0, // nộp đủ các ngày trong tuần
    },
    {
      email: "intern.b@nexcampus.local",
      deptType: "Frontend",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.5, // 50% trễ giờ
      missingChance: 0.2, // 20% quên nộp
    },
    {
      email: "intern.c@nexcampus.local",
      deptType: "Backend", // Thực chất Mobile nhưng Backend content cũng được
      startOffset: -120,
      endOffset: -30, // Đã hoàn thành cách đây 1 tháng
      lateChance: 0.05,
      missingChance: 0.02,
    },
    {
      email: "intern.d@nexcampus.local",
      deptType: "Backend", // DevOps
      startOffset: -45,
      endOffset: -31, // Chỉ nộp 2 tuần rồi nghỉ ngang
      lateChance: 0.1,
      missingChance: 0.0,
    },
    {
      email: "intern.h@nexcampus.local",
      deptType: "Backend",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.1,
      missingChance: 0.05,
    },
    {
      email: "intern.i@nexcampus.local",
      deptType: "Frontend",
      startOffset: -7,
      endOffset: 0,
      lateChance: 0.0,
      missingChance: 0.0,
    },
    {
      email: "intern.e@nexcampus.local",
      deptType: "UI/UX",
      startOffset: -2,
      endOffset: 0,
      lateChance: 0.0,
      missingChance: 0.0,
    },
    {
      email: "intern.j@nexcampus.local",
      deptType: "UI/UX",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.2,
      missingChance: 0.1,
    },
    {
      email: "intern.k@nexcampus.local",
      deptType: "UI/UX", // Graphic
      startOffset: -105,
      endOffset: -15,
      lateChance: 0.1,
      missingChance: 0.02,
    },
    {
      email: "intern.f@nexcampus.local",
      deptType: "Marketing",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.15,
      missingChance: 0.1,
    },
    {
      email: "intern.l@nexcampus.local",
      deptType: "Marketing",
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.0,
      missingChance: 0.0,
    },
    {
      email: "intern.m@nexcampus.local",
      deptType: "Marketing", // SEO
      startOffset: -28,
      endOffset: 0,
      lateChance: 0.4,
      missingChance: 0.25,
    },
    {
      email: "intern.g@nexcampus.local",
      deptType: "HR",
      startOffset: -14,
      endOffset: 0,
      lateChance: 0.0,
      missingChance: 0.0,
    },
    {
      email: "intern.n@nexcampus.local",
      deptType: "HR",
      startOffset: -14,
      endOffset: 0,
      lateChance: 0.1,
      missingChance: 0.05,
    },
  ];

  function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Chủ nhật hoặc Thứ bảy
  }

  const reportsToInsert: Array<{
    internId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  for (const item of config) {
    const internId = interns[item.email];
    if (!internId) continue;

    const pool = contentPool[item.deptType] || contentPool["Backend"];

    // Duyệt qua từng ngày trong khoảng thực tập
    for (let dayOffset = item.startOffset; dayOffset <= item.endOffset; dayOffset++) {
      const dateToCheck = new Date();
      dateToCheck.setDate(dateToCheck.getDate() + dayOffset);

      if (isWeekend(dateToCheck)) {
        continue; // Bỏ qua ngày cuối tuần
      }

      // Kiểm tra cơ hội quên nộp
      if (Math.random() < item.missingChance) {
        continue;
      }

      // Xác định giờ nộp
      const isLate = Math.random() < item.lateChance;
      // Đúng giờ: 16h00 - 17h45. Trễ giờ: 18h30 - 20h30.
      const hour = isLate ? 18 + Math.floor(Math.random() * 3) : 15 + Math.floor(Math.random() * 3);
      const minute = Math.floor(Math.random() * 60);

      const createdAt = getVnDate(dayOffset, hour, minute);

      // Lấy nội dung ngẫu nhiên trong pool
      const index = Math.abs(dayOffset) % pool.length;
      const content = pool[index];

      reportsToInsert.push({
        internId,
        content,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // Chia nhỏ mảng để insert nhiều bản ghi tránh lỗi database payload size limits
  const chunkSize = 200;
  for (let i = 0; i < reportsToInsert.length; i += chunkSize) {
    const chunk = reportsToInsert.slice(i, i + chunkSize);
    await prisma.dailyReport.createMany({
      data: chunk,
    });
  }

  console.log(`   ✓ Seeded ${reportsToInsert.length} daily reports.`);
}
