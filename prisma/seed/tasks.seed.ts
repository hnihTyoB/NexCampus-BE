import { PrismaClient, AssignmentStatus, ReviewStatus, TaskPriority } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedTasks(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string> // email -> user.id
): Promise<void> {
  console.log("-> Seeding Task Groups, Tasks, Assignments, Submissions...");

  const leader1Id = leaders["leader1@nexcampus.local"];
  const leader2Id = leaders["leader2@nexcampus.local"];
  const leader3Id = leaders["leader3@nexcampus.local"];
  const leader4Id = leaders["leader4@nexcampus.local"];

  // Lấy danh sách Department để lấy ID tương ứng
  const depts = await prisma.department.findMany();
  const deptEng = depts.find(d => d.name === "Kỹ thuật Công nghệ")?.id || null;
  const deptDesign = depts.find(d => d.name === "Thiết kế Giao diện")?.id || null;
  const deptMkt = depts.find(d => d.name === "Marketing")?.id || null;
  const deptHr = depts.find(d => d.name === "Nhân sự")?.id || null;

  // 1. Tạo các Task Groups
  const groupsData = [
    { name: "Thực tập Backend - Cơ bản", description: "Các task thiết lập và API cơ bản", departmentId: deptEng },
    { name: "Thực tập Frontend - Cơ bản", description: "Các task xây dựng UI cơ bản", departmentId: deptEng },
    { name: "Thực tập Mobile - Cơ bản", description: "Các task React Native cơ bản", departmentId: deptEng },
    { name: "Thực tập DevOps - Cơ bản", description: "Các task CI/CD và môi trường", departmentId: deptEng },
    { name: "Thiết kế UI/UX - Cơ bản", description: "Các task thiết kế giao diện Figma", departmentId: deptDesign },
    { name: "Thiết kế Đồ hoạ - Cơ bản", description: "Các task banner marketing", departmentId: deptDesign },
    { name: "Marketing Content - Giai đoạn 1", description: "Các task viết bài và kịch bản", departmentId: deptMkt },
    { name: "SEO Website - Giai đoạn 1", description: "Các task tối ưu on-page & off-page", departmentId: deptMkt },
    { name: "Tuyển dụng HR - Giai đoạn 1", description: "Các task tìm kiếm ứng viên", departmentId: deptHr },
  ];

  const groupMap: Record<string, string> = {};

  for (const g of groupsData) {
    const group = await prisma.taskGroup.upsert({
      where: {
        name_departmentId: {
          name: g.name,
          departmentId: g.departmentId || "",
        }
      },
      update: { description: g.description },
      create: {
        name: g.name,
        description: g.description,
        departmentId: g.departmentId,
      },
    });
    groupMap[g.name] = group.id;
  }
  console.log("   ✓ Task Groups seeded.");

  // Helper function to create Task -> Assignment -> Submissions in sequence
  async function createScenario({
    internEmail,
    leaderId,
    groupName,
    code,
    title,
    desc,
    priority,
    status,
    deadlineOffset, // so với reference date (now)
    submissions = [],
  }: {
    internEmail: string;
    leaderId: string;
    groupName: string;
    code: string;
    title: string;
    desc: string;
    priority: TaskPriority;
    status: AssignmentStatus;
    deadlineOffset: number;
    submissions?: Array<{
      attempt: number;
      prLink?: string;
      videoDemo?: string;
      note?: string;
      reviewStatus: ReviewStatus;
      reviewComment?: string;
      reviewedOffsetDays?: number;
      submittedOffsetDays?: number;
    }>;
  }) {
    const internId = interns[internEmail];
    if (!internId) return;

    const groupId = groupMap[groupName];

    // 1. Tạo Task
    // Lưu ý: TaskGroupId + code là unique
    const task = await prisma.task.create({
      data: {
        taskGroupId: groupId,
        code,
        title,
        description: desc,
        deadline: getVnDate(deadlineOffset, 18, 0),
        priority,
        createdBy: leaderId,
      },
    });

    // 2. Tạo Assignment
    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        internId,
        assignedBy: leaderId,
        status,
        assignedAt: getVnDate(-30, 8, 0),
      },
    });

    // 3. Tạo Submissions
    for (const sub of submissions) {
      const submittedAt = sub.submittedOffsetDays 
        ? getVnDate(sub.submittedOffsetDays, 17, 30)
        : getVnDate(deadlineOffset - 1, 17, 30); // mặc định trước deadline 1 ngày
      
      const reviewedAt = sub.reviewedOffsetDays 
        ? getVnDate(sub.reviewedOffsetDays, 10, 0)
        : getVnDate(deadlineOffset, 10, 0); // mặc định tại ngày deadline

      await prisma.taskSubmission.create({
        data: {
          assignmentId: assignment.id,
          attempt: sub.attempt,
          prLink: sub.prLink || "https://github.com/NexCampus/repo/pull/mock",
          videoDemo: sub.videoDemo || "https://youtube.com/watch?v=mock",
          note: sub.note || "Em nộp bài ạ.",
          reviewStatus: sub.reviewStatus,
          reviewComment: sub.reviewComment || null,
          reviewedBy: sub.reviewStatus !== "PENDING" ? leaderId : null,
          reviewedAt: sub.reviewStatus !== "PENDING" ? reviewedAt : null,
          submittedAt,
        },
      });
    }
  }

  // --- INTERN A: "Ngôi sao công nghệ" (8 tasks DONE, submissions APPROVED) ---
  for (let i = 1; i <= 8; i++) {
    await createScenario({
      internEmail: "intern.a@nexcampus.local",
      leaderId: leader1Id,
      groupName: "Thực tập Backend - Cơ bản",
      code: `BE-A-00${i}`,
      title: `Backend Task ${i}: Xây dựng API resource ${i}`,
      desc: `Mô tả chi tiết cho Backend Task ${i}`,
      priority: i % 3 === 0 ? "HIGH" : i % 3 === 1 ? "MEDIUM" : "LOW",
      status: "DONE",
      deadlineOffset: -28 + (i * 3), // rải rác trong quá khứ
      submissions: [
        {
          attempt: 1,
          prLink: `https://github.com/NexCampus/BE/pull/10${i}`,
          videoDemo: `https://youtube.com/watch?v=video10${i}`,
          note: `Hoàn thành API ${i} chạy test ok.`,
          reviewStatus: "APPROVED",
          reviewComment: `Code sạch, đạt chuẩn, duyệt API ${i}.`,
          submittedOffsetDays: -28 + (i * 3) - 1, // nộp trước 1 ngày
          reviewedOffsetDays: -28 + (i * 3),
        }
      ]
    });
  }

  // --- INTERN B: "Đang gặp khó khăn" ---
  // Task 1: DONE (sau 3 lần nộp bị REJECTED)
  await createScenario({
    internEmail: "intern.b@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-B-001",
    title: "Frontend Task 1: Tích hợp Axios và viết Mock API Client",
    desc: "Viết Axios Client cấu hình token, interceptors và log lỗi",
    priority: "HIGH",
    status: "DONE",
    deadlineOffset: -20,
    submissions: [
      {
        attempt: 1,
        note: "Em nộp bài lần 1.",
        reviewStatus: "REJECTED",
        reviewComment: "Thiếu cấu hình log lỗi và interceptors cho token.",
        submittedOffsetDays: -22,
        reviewedOffsetDays: -21,
      },
      {
        attempt: 2,
        note: "Em đã sửa thêm interceptors.",
        reviewStatus: "REJECTED",
        reviewComment: "Vẫn thiếu log lỗi ở response error catch.",
        submittedOffsetDays: -21,
        reviewedOffsetDays: -20,
      },
      {
        attempt: 3,
        note: "Em bổ sung log lỗi đầy đủ.",
        reviewStatus: "APPROVED",
        reviewComment: "Tốt, code chạy đúng, đã approve.",
        submittedOffsetDays: -20,
        reviewedOffsetDays: -19,
      }
    ]
  });

  // Task 2 & 3: IN_PROGRESS (Quá hạn)
  await createScenario({
    internEmail: "intern.b@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-B-002",
    title: "Frontend Task 2: Code UI trang dashboard admin",
    desc: "Yêu cầu UI responsive, dùng Tailwind CSS và thiết kế biểu đồ",
    priority: "HIGH",
    status: "IN_PROGRESS",
    deadlineOffset: -5, // quá hạn 5 ngày
  });
  await createScenario({
    internEmail: "intern.b@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-B-003",
    title: "Frontend Task 3: Form validate thông tin Onboarding",
    desc: "Form dùng React Hook Form và Zod schema",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    deadlineOffset: -2, // quá hạn 2 ngày
  });

  // Task 4: BLOCKED
  await createScenario({
    internEmail: "intern.b@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-B-004",
    title: "Frontend Task 4: Kết nối Webhook Discord",
    desc: "Kết nối hệ thống báo cáo với Webhook Discord channel",
    priority: "LOW",
    status: "BLOCKED",
    deadlineOffset: 2, // deadline sắp tới
  });

  // Task 5: REVIEW (Chờ duyệt)
  await createScenario({
    internEmail: "intern.b@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-B-005",
    title: "Frontend Task 5: Tối ưu hoá tải ảnh",
    desc: "Lazy load và resize ảnh đại diện cho user",
    priority: "MEDIUM",
    status: "REVIEW",
    deadlineOffset: 1,
    submissions: [
      {
        attempt: 1,
        note: "Em đã hoàn thành tối ưu ảnh bằng Component Image của Next.js.",
        reviewStatus: "PENDING",
        submittedOffsetDays: 0, // nộp hôm nay
      }
    ]
  });

  // --- INTERN C: "Đã hoàn thành xuất sắc" (4 tasks DONE) ---
  for (let i = 1; i <= 4; i++) {
    await createScenario({
      internEmail: "intern.c@nexcampus.local",
      leaderId: leader1Id,
      groupName: "Thực tập Mobile - Cơ bản",
      code: `MOB-C-00${i}`,
      title: `Mobile Task ${i}: Code tính năng ${i} cho React Native`,
      desc: `Mobile Task ${i} description`,
      priority: "MEDIUM",
      status: "DONE",
      deadlineOffset: -120 + (i * 10),
      submissions: [
        {
          attempt: 1,
          reviewStatus: "APPROVED",
          reviewComment: "Tốt.",
          submittedOffsetDays: -120 + (i * 10) - 2,
          reviewedOffsetDays: -120 + (i * 10),
        }
      ]
    });
  }

  // --- INTERN D: "Nghỉ ngang giữa chừng" (1 DONE, 2 TODO) ---
  await createScenario({
    internEmail: "intern.d@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập DevOps - Cơ bản",
    code: "DO-D-001",
    title: "DevOps Task 1: Cấu hình Github Actions Docker build",
    desc: "Tự động build image Docker và push lên Docker Hub",
    priority: "HIGH",
    status: "DONE",
    deadlineOffset: -40,
    submissions: [
      {
        attempt: 1,
        reviewStatus: "APPROVED",
        reviewComment: "Tuyệt vời, CI chạy nhanh.",
        submittedOffsetDays: -42,
        reviewedOffsetDays: -40,
      }
    ]
  });
  await createScenario({
    internEmail: "intern.d@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập DevOps - Cơ bản",
    code: "DO-D-002",
    title: "DevOps Task 2: Viết script backup Postgres database",
    desc: "Tự động backup và upload lên AWS S3 hàng ngày",
    priority: "HIGH",
    status: "TODO",
    deadlineOffset: -30,
  });
  await createScenario({
    internEmail: "intern.d@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập DevOps - Cơ bản",
    code: "DO-D-003",
    title: "DevOps Task 3: Setup Prometheus & Grafana",
    desc: "Giám sát hiệu năng CPU/RAM của server Express",
    priority: "MEDIUM",
    status: "TODO",
    deadlineOffset: -20,
  });

  // --- INTERN H: Backend Khá (5 tasks: 3 DONE, 2 IN_PROGRESS) ---
  for (let i = 1; i <= 5; i++) {
    const isDone = i <= 3;
    await createScenario({
      internEmail: "intern.h@nexcampus.local",
      leaderId: leader1Id,
      groupName: "Thực tập Backend - Cơ bản",
      code: `BE-H-00${i}`,
      title: `Backend Task H${i}: Viết unit test module ${i}`,
      desc: `Backend Unit Test H${i}`,
      priority: "MEDIUM",
      status: isDone ? "DONE" : "IN_PROGRESS",
      deadlineOffset: isDone ? -28 + (i * 5) : 10,
      submissions: isDone ? [
        {
          attempt: 1,
          reviewStatus: "APPROVED",
          reviewComment: "Đạt yêu cầu.",
          submittedOffsetDays: -28 + (i * 5) - 1,
          reviewedOffsetDays: -28 + (i * 5),
        }
      ] : []
    });
  }

  // --- INTERN I: Frontend Mới (2 tasks: 1 TODO, 1 IN_PROGRESS) ---
  await createScenario({
    internEmail: "intern.i@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-I-001",
    title: "Frontend Task I1: Tìm hiểu UI Design System",
    desc: "Đọc tài liệu Figma và globals.css",
    priority: "LOW",
    status: "IN_PROGRESS",
    deadlineOffset: 2,
  });
  await createScenario({
    internEmail: "intern.i@nexcampus.local",
    leaderId: leader1Id,
    groupName: "Thực tập Frontend - Cơ bản",
    code: "FE-I-002",
    title: "Frontend Task I2: Dựng màn hình Login",
    desc: "Dựng form login theo design",
    priority: "MEDIUM",
    status: "TODO",
    deadlineOffset: 5,
  });

  // --- INTERN E: UI/UX Mới (1 task TODO) ---
  await createScenario({
    internEmail: "intern.e@nexcampus.local",
    leaderId: leader2Id,
    groupName: "Thiết kế UI/UX - Cơ bản",
    code: "UI-E-001",
    title: "Design Task E1: Thiết kế Wireframe Onboarding Flow",
    desc: "Vẽ wireframe trên Figma cho 3 bước onboarding",
    priority: "HIGH",
    status: "TODO",
    deadlineOffset: 4,
  });

  // --- INTERN J: UI/UX Khá (4 tasks: 2 DONE, 1 IN_PROGRESS, 1 REVIEW) ---
  await createScenario({
    internEmail: "intern.j@nexcampus.local",
    leaderId: leader2Id,
    groupName: "Thiết kế UI/UX - Cơ bản",
    code: "UI-J-001",
    title: "Design Task J1: Nghiên cứu đối thủ cạnh tranh",
    desc: "Phân tích UX flow của 3 nền tảng quản lý thực tập sinh khác",
    priority: "MEDIUM",
    status: "DONE",
    deadlineOffset: -20,
    submissions: [{ attempt: 1, reviewStatus: "APPROVED", reviewComment: "Phân tích chi tiết tốt.", submittedOffsetDays: -22, reviewedOffsetDays: -20 }]
  });
  await createScenario({
    internEmail: "intern.j@nexcampus.local",
    leaderId: leader2Id,
    groupName: "Thiết kế UI/UX - Cơ bản",
    code: "UI-J-002",
    title: "Design Task J2: Tạo User Persona và Storyboard",
    desc: "Xây dựng 2 Persona đại diện cho Leader và Intern",
    priority: "HIGH",
    status: "DONE",
    deadlineOffset: -10,
    submissions: [{ attempt: 1, reviewStatus: "APPROVED", reviewComment: "Khớp thực tế.", submittedOffsetDays: -11, reviewedOffsetDays: -10 }]
  });
  await createScenario({
    internEmail: "intern.j@nexcampus.local",
    leaderId: leader2Id,
    groupName: "Thiết kế UI/UX - Cơ bản",
    code: "UI-J-003",
    title: "Design Task J3: Thiết kế Hi-Fi Mockup màn Dashboard",
    desc: "Tạo Mockup chi tiết với biểu đồ và danh sách task",
    priority: "HIGH",
    status: "IN_PROGRESS",
    deadlineOffset: 5,
  });
  await createScenario({
    internEmail: "intern.j@nexcampus.local",
    leaderId: leader2Id,
    groupName: "Thiết kế UI/UX - Cơ bản",
    code: "UI-J-004",
    title: "Design Task J4: Tạo prototype tương tác",
    desc: "Tạo link prototype click-through cơ bản trên Figma",
    priority: "MEDIUM",
    status: "REVIEW",
    deadlineOffset: 2,
    submissions: [{ attempt: 1, reviewStatus: "PENDING", note: "Figma prototype link: https://figma.com/file/mock-proto", submittedOffsetDays: 0 }]
  });

  // --- INTERN K: Graphic Design Completed (6 tasks DONE) ---
  for (let i = 1; i <= 6; i++) {
    await createScenario({
      internEmail: "intern.k@nexcampus.local",
      leaderId: leader2Id,
      groupName: "Thiết kế Đồ hoạ - Cơ bản",
      code: `GD-K-00${i}`,
      title: `Graphic Task K${i}: Thiết kế asset banner ${i}`,
      desc: `Graphic Asset ${i}`,
      priority: "LOW",
      status: "DONE",
      deadlineOffset: -105 + (i * 10),
      submissions: [{ attempt: 1, reviewStatus: "APPROVED", reviewComment: "Đã nhận banner.", submittedOffsetDays: -105 + (i * 10) - 2, reviewedOffsetDays: -105 + (i * 10) }]
    });
  }

  // --- INTERN F: Marketing Trung bình (5 tasks: 3 DONE, 2 IN_PROGRESS) ---
  for (let i = 1; i <= 5; i++) {
    const isDone = i <= 3;
    await createScenario({
      internEmail: "intern.f@nexcampus.local",
      leaderId: leader3Id,
      groupName: "Marketing Content - Giai đoạn 1",
      code: `MKT-F-00${i}`,
      title: `Marketing Task F${i}: Viết bài Content Social ${i}`,
      desc: `Bài viết cho page tuần ${i}`,
      priority: "MEDIUM",
      status: isDone ? "DONE" : "IN_PROGRESS",
      deadlineOffset: isDone ? -28 + (i * 5) : 8,
      submissions: isDone ? [
        {
          attempt: 1,
          reviewStatus: "APPROVED",
          reviewComment: "Đạt yêu cầu.",
          submittedOffsetDays: -28 + (i * 5) - (i === 3 ? -1 : 1), // task 3 bị nộp trễ 1 ngày
          reviewedOffsetDays: -28 + (i * 5) + 1,
        }
      ] : []
    });
  }

  // --- INTERN L: Content Tốt (5 tasks: 4 DONE, 1 IN_PROGRESS) ---
  for (let i = 1; i <= 5; i++) {
    const isDone = i <= 4;
    await createScenario({
      internEmail: "intern.l@nexcampus.local",
      leaderId: leader3Id,
      groupName: "Marketing Content - Giai đoạn 1",
      code: `MKT-L-00${i}`,
      title: `Marketing Task L${i}: Viết kịch bản video TikTok ${i}`,
      desc: `Kịch bản chi tiết ${i}`,
      priority: "HIGH",
      status: isDone ? "DONE" : "IN_PROGRESS",
      deadlineOffset: isDone ? -28 + (i * 5) : 12,
      submissions: isDone ? [
        {
          attempt: 1,
          reviewStatus: "APPROVED",
          reviewComment: "Rất hay, duyệt.",
          submittedOffsetDays: -28 + (i * 5) - 1,
          reviewedOffsetDays: -28 + (i * 5),
        }
      ] : []
    });
  }

  // --- INTERN M: SEO Blocked (4 tasks: 1 DONE, 2 BLOCKED, 1 IN_PROGRESS quá hạn) ---
  await createScenario({
    internEmail: "intern.m@nexcampus.local",
    leaderId: leader3Id,
    groupName: "SEO Website - Giai đoạn 1",
    code: "SEO-M-001",
    title: "SEO Task M1: Tối ưu On-page các bài viết cũ",
    desc: "Tối ưu Meta title, meta description và heading tags",
    priority: "MEDIUM",
    status: "DONE",
    deadlineOffset: -20,
    submissions: [{ attempt: 1, reviewStatus: "APPROVED", reviewComment: "Đã làm tốt.", submittedOffsetDays: -21, reviewedOffsetDays: -20 }]
  });
  await createScenario({
    internEmail: "intern.m@nexcampus.local",
    leaderId: leader3Id,
    groupName: "SEO Website - Giai đoạn 1",
    code: "SEO-M-002",
    title: "SEO Task M2: Phân tích backlink bằng Ahrefs",
    desc: "Sử dụng tài khoản Ahrefs công ty để lấy báo cáo backlink của đối thủ",
    priority: "HIGH",
    status: "BLOCKED",
    deadlineOffset: -5, // Quá hạn và bị Blocked do không có tài khoản Ahrefs
  });
  await createScenario({
    internEmail: "intern.m@nexcampus.local",
    leaderId: leader3Id,
    groupName: "SEO Website - Giai đoạn 1",
    code: "SEO-M-003",
    title: "SEO Task M3: Setup Google Search Console",
    desc: "Kết nối tên miền dự án với GSC",
    priority: "HIGH",
    status: "BLOCKED",
    deadlineOffset: -2, // Quá hạn và bị Blocked
  });
  await createScenario({
    internEmail: "intern.m@nexcampus.local",
    leaderId: leader3Id,
    groupName: "SEO Website - Giai đoạn 1",
    code: "SEO-M-004",
    title: "SEO Task M4: Lập file bộ từ khoá SEO chính",
    desc: "Tìm 100 từ khoá tiềm năng về mảng giáo dục",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    deadlineOffset: -1, // Quá hạn
  });

  // --- INTERN N: Recruiter (2 tasks IN_PROGRESS) ---
  await createScenario({
    internEmail: "intern.n@nexcampus.local",
    leaderId: leader4Id,
    groupName: "Tuyển dụng HR - Giai đoạn 1",
    code: "HR-N-001",
    title: "HR Task N1: Sàng lọc CV Frontend trên LinkedIn",
    desc: "Lọc 10 CV Frontend Intern chất lượng",
    priority: "HIGH",
    status: "IN_PROGRESS",
    deadlineOffset: 3,
  });
  await createScenario({
    internEmail: "intern.n@nexcampus.local",
    leaderId: leader4Id,
    groupName: "Tuyển dụng HR - Giai đoạn 1",
    code: "HR-N-002",
    title: "HR Task N2: Gọi điện hẹn phỏng vấn sơ loại",
    desc: "Hẹn 5 ứng viên làm bài test chuyên môn",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    deadlineOffset: 5,
  });

  console.log("   ✓ Tasks, Assignments, Submissions seeded.");
}
