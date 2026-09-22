import { PrismaClient } from "@prisma/client";
import { getVnDate, getVnDateOnly } from "./helper";

export async function seedReports(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string> // email -> user.id
): Promise<void> {
  console.log("\n[5/8] Khởi tạo Báo cáo tiến độ hằng ngày (Daily Reports)...");

  const leaderEngId = leaders["leader@nexcampus.com"];
  const leaderQaId = leaders["leader.qa@nexcampus.com"];
  const leaderDesignId = leaders["leader.design@nexcampus.com"];
  const leaderMktId = leaders["leader.mkt@nexcampus.com"];
  const leaderHrId = leaders["leader.hr@nexcampus.com"];

  const contentPool: Record<string, string[]> = {
    Backend: [
      "Tìm hiểu cấu trúc module và hoàn thiện API Authentication JWT + Refresh Token.",
      "Tối ưu hoá các truy vấn Prisma và tạo composite index tăng tốc độ query.",
      "Viết unit test cho tầng Service và Repository của module Task Assignment.",
      "Tích hợp Cloudflare R2 presigned PUT URL cho phép tải tệp đính kèm trực tiếp.",
      "Xử lý và khắc phục lỗi race condition khi claim email notification hàng loạt.",
      "Refactor mã nguồn theo chuẩn Clean Architecture: route -> controller -> service -> repo.",
      "Nghiên cứu cơ chế Rate Limiting RFC 6585 và chống tấn công SSRF.",
      "Tham gia họp giao ban đầu tuần với Mentor, cập nhật tiến độ sprint.",
    ],
    Frontend: [
      "Dựng giao diện khung cho trang Leader Daily Reports bằng Tailwind CSS.",
      "Validate form nộp hồ sơ Onboarding bằng React Hook Form kết hợp Zod schema.",
      "Tích hợp API đăng nhập và lưu token vào LocalStorage/Cookie an toàn.",
      "Sửa lỗi hiển thị UI bị vỡ trên thiết bị di động (Responsive calendar grid).",
      "Viết component MetalCard và NeonButton tái sử dụng cho Design System.",
      "Tối ưu tốc độ tải trang bằng Next.js Image Component và Code Splitting.",
      "Tích hợp React Query để quản lý cache server state và tự động refetch.",
      "Cập nhật trạng thái công việc trên Kanban board theo phản hồi của Leader.",
    ],
    QA: [
      "Viết kịch bản kiểm thử (Test Cases) chi tiết cho module Authentication & 2FA.",
      "Thực hiện kiểm thử chức năng Nộp bài làm công việc và phát hiện 2 bugs giao diện.",
      "Viết kịch bản tự động hóa Playwright cho luồng Daily Report submission.",
      "Kiểm tra tính tương thích của hệ thống trên các trình duyệt Chrome, Firefox, Safari.",
      "Tạo báo cáo lỗi (Bug Report) trên Jira kèm log và video minh chứng.",
    ],
    Design: [
      "Nghiên cứu trải nghiệm người dùng và vẽ wireframe cho luồng nộp báo cáo ngày.",
      "Thiết kế Hi-Fi Mockup cho màn hình quản lý công việc trên Figma.",
      "Tạo prototype liên kết các màn hình để demo luồng duyệt bài nộp cho Leader.",
      "Xây dựng thư viện component UI (Color palette, Typography, Grid tokens).",
      "Khảo sát ý kiến thực tập sinh về độ dễ dùng của tính năng lịch tháng.",
    ],
    Marketing: [
      "Lên kế hoạch nội dung tuần mới cho kênh Fanpage và LinkedIn.",
      "Viết bài content chi tiết giới thiệu về chương trình thực tập sinh NexCampus.",
      "Nghiên cứu bộ từ khoá SEO mảng công nghệ thông tin và giáo dục.",
      "Viết kịch bản chi tiết cho video TikTok hướng nghiệp sinh viên thực tập.",
      "Phân tích lượng truy cập website tuần qua trên Google Analytics.",
    ],
    HR: [
      "Nghiên cứu quy chế thực tập và quy trình tuyển dụng onboarding của công ty.",
      "Sàng lọc 20 hồ sơ ứng viên vị trí Frontend & Backend Intern trên LinkedIn.",
      "Liên hệ qua email và gọi điện hẹn lịch phỏng vấn sơ loại cho 5 ứng viên.",
      "Chuẩn bị tài liệu câu hỏi phỏng vấn chuyên môn cho Mentor.",
      "Hỗ trợ hướng dẫn thực tập sinh mới gia nhập tiếp nhận tài khoản và thiết bị.",
    ],
  };

  const internConfigs = [
    {
      email: "intern@nexcampus.com",
      deptType: "Backend",
      leaderId: leaderEngId,
      startOffset: -30,
      endOffset: 0, // Bao gồm cả hôm nay (offset 0)!
      lateChance: 0.0, // 100% đúng giờ
      missingChance: 0.0, // Không bỏ ngày nào
      hasAttachments: true,
    },
    {
      email: "intern.b@nexcampus.com",
      deptType: "Frontend",
      leaderId: leaderEngId,
      startOffset: -30,
      endOffset: -1, // Hôm nay chưa nộp! (offset -1 là hôm qua)
      lateChance: 0.6, // 60% nộp trễ
      missingChance: 0.25, // 25% quên nộp
      hasAttachments: false,
    },
    {
      email: "intern.f@nexcampus.com",
      deptType: "QA",
      leaderId: leaderQaId,
      startOffset: -25,
      endOffset: 0,
      lateChance: 0.1,
      missingChance: 0.08,
      hasAttachments: true,
    },
    {
      email: "intern.g@nexcampus.com",
      deptType: "Backend",
      leaderId: leaderEngId,
      startOffset: -20,
      endOffset: 0,
      lateChance: 0.3,
      missingChance: 0.15,
      hasAttachments: false,
    },
    {
      email: "intern.h@nexcampus.com",
      deptType: "QA",
      leaderId: leaderQaId,
      startOffset: -25,
      endOffset: 0,
      lateChance: 0.05,
      missingChance: 0.05,
      hasAttachments: true,
    },
    {
      email: "intern.j@nexcampus.com",
      deptType: "Design",
      leaderId: leaderDesignId,
      startOffset: -25,
      endOffset: 0,
      lateChance: 0.1,
      missingChance: 0.05,
      hasAttachments: true,
    },
    {
      email: "intern.l@nexcampus.com",
      deptType: "Marketing",
      leaderId: leaderMktId,
      startOffset: -25,
      endOffset: 0,
      lateChance: 0.0,
      missingChance: 0.0,
      hasAttachments: false,
    },
    {
      email: "intern.m@nexcampus.com",
      deptType: "Marketing",
      leaderId: leaderMktId,
      startOffset: -25,
      endOffset: -1,
      lateChance: 0.5,
      missingChance: 0.3,
      hasAttachments: false,
    },
    {
      email: "intern.n@nexcampus.com",
      deptType: "HR",
      leaderId: leaderHrId,
      startOffset: -15,
      endOffset: 0,
      lateChance: 0.05,
      missingChance: 0.0,
      hasAttachments: false,
    },
  ];

  function isSunday(d: Date): boolean {
    return d.getDay() === 0; // Nghỉ chủ nhật, làm việc T2 - T7
  }

  let totalReports = 0;

  for (const cfg of internConfigs) {
    const internId = interns[cfg.email];
    if (!internId) continue;

    const pool = contentPool[cfg.deptType] || contentPool["Backend"];

    for (let dayOffset = cfg.startOffset; dayOffset <= cfg.endOffset; dayOffset++) {
      const reportDateOnly = getVnDateOnly(dayOffset);

      if (isSunday(reportDateOnly)) {
        continue; // Bỏ qua Chủ Nhật
      }

      // Kiểm tra tỷ lệ quên nộp (ngoại trừ hôm nay offset = 0)
      if (dayOffset < 0 && Math.random() < cfg.missingChance) {
        continue;
      }

      const isLate = Math.random() < cfg.lateChance;
      // Nộp đúng giờ: 16:30 - 17:25 (trước hạn 17:30). Nộp trễ: 18:15 - 20:30.
      const hour = isLate ? 18 + Math.floor(Math.random() * 3) : 16;
      const minute = isLate ? Math.floor(Math.random() * 50) : 30 + Math.floor(Math.random() * 25);
      const createdAt = getVnDate(dayOffset, hour, minute);

      const contentIndex = Math.abs(dayOffset) % pool.length;
      const content = pool[contentIndex];

      const hasBlocker = isLate || (dayOffset % 4 === 0 && cfg.email === "intern.b@nexcampus.com");
      const blockers = hasBlocker
        ? "Gặp vướng mắc khi gọi API qua proxy, cần Mentor hỗ trợ hướng dẫn giải quyết."
        : null;

      const nextPlan = "Tiếp tục giải quyết các task backlog và viết tài liệu kỹ thuật.";
      const hoursWorked = dayOffset % 5 === 0 ? 7.5 : 8.0;

      // Nhận xét của Leader:
      // Các báo cáo trong quá khứ (> 1 ngày) đã được Leader nhận xét.
      // Báo cáo hôm nay (offset 0) hoặc hôm qua (offset -1) có thể đang chờ nhận xét.
      const isPast = dayOffset < -1;
      const hasFeedback = isPast || (dayOffset === -1 && Math.random() > 0.5);

      const feedback = hasFeedback
        ? (isLate
            ? "Báo cáo nộp hơi muộn, em cần chú ý nộp trước 17:30 để tổng hợp tiến độ kịp thời nhé. Nội dung công việc tốt."
            : "Leader đã xem và ghi nhận tiến độ rất tốt. Tiếp tục phát huy nhé!")
        : null;

      const feedbackBy = hasFeedback ? cfg.leaderId : null;
      const feedbackAt = hasFeedback ? getVnDate(dayOffset + 1, 9, 30) : null;

      const report = await prisma.dailyReport.upsert({
        where: {
          internId_date: {
            internId,
            date: reportDateOnly,
          },
        },
        update: {
          content,
          blockers,
          nextPlan,
          hoursWorked,
          feedback,
          feedbackBy,
          feedbackAt,
          createdAt,
          updatedAt: feedbackAt || createdAt,
        },
        create: {
          internId,
          date: reportDateOnly,
          content,
          blockers,
          nextPlan,
          hoursWorked,
          prLink: `https://github.com/nexcampus/project/pull/${Math.abs(dayOffset) + 50}`,
          videoDemo: dayOffset % 3 === 0 ? "https://youtube.com/watch?v=mockdemo" : null,
          feedback,
          feedbackBy,
          feedbackAt,
          createdAt,
          updatedAt: feedbackAt || createdAt,
        },
      });

      totalReports++;

      // Tệp đính kèm báo cáo mẫu
      if (cfg.hasAttachments && Math.abs(dayOffset) % 4 === 0) {
        const internUser = await prisma.intern.findUnique({ where: { id: internId } });
        await prisma.reportAttachment.create({
          data: {
            reportId: report.id,
            fileName: `daily_evidence_day_${Math.abs(dayOffset)}.png`,
            fileUrl: `https://storage.nexcampus.com/reports/evidence_${report.id}.png`,
            filePath: `reports/${report.id}/evidence.png`,
            mimeType: "image/png",
            fileSize: 345000,
            uploadedBy: internUser?.userId || cfg.leaderId,
          },
        });
      }
    }
  }

  console.log(`   ✓ Đã tạo thành công ${totalReports} báo cáo ngày (bao quát đầy đủ các ngày trong tháng, hôm nay và tuần này).`);
}
