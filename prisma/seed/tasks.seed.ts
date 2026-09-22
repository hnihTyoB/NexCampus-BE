import {
  PrismaClient,
  AssignmentStatus,
  ReviewStatus,
  TaskPriority,
  TaskGroupStatus,
} from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedTasks(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string>, // email -> user.id
  deptMap: Record<string, string>
): Promise<void> {
  console.log("\n[4/8] Khởi tạo Nhóm công việc, Công việc & Bài nộp (Tasks, Assignments, Submissions)...");

  const leaderEngId = leaders["leader@nexcampus.com"];
  const leaderQaId = leaders["leader.qa@nexcampus.com"];
  const leaderDesignId = leaders["leader.design@nexcampus.com"];
  const leaderMktId = leaders["leader.mkt@nexcampus.com"];
  const leaderHrId = leaders["leader.hr@nexcampus.com"];

  const deptEng = deptMap["Kỹ thuật phần mềm (Software Engineering)"];
  const deptQa = deptMap["Kiểm thử chất lượng (QA/QC)"];
  const deptDesign = deptMap["Thiết kế sản phẩm (UI/UX)"];
  const deptMkt = deptMap["Marketing & Truyền thông"];
  const deptHr = deptMap["Nhân sự & Đào tạo (HR)"];

  // 1. Task Groups
  const groupsData = [
    {
      name: "Thực tập Backend & API Core",
      description: "Phát triển kiến trúc API RESTful, Authentication và cơ sở dữ liệu",
      departmentId: deptEng,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern@nexcampus.com", "intern.g@nexcampus.com", "intern.c@nexcampus.com"],
    },
    {
      name: "Thực tập Frontend & UI Components",
      description: "Xây dựng các trang giao diện Dashboard, form biểu mẫu và quản lý state",
      departmentId: deptEng,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.b@nexcampus.com", "intern.i@nexcampus.com"],
    },
    {
      name: "Thực tập DevOps & CI/CD",
      description: "Cấu hình Docker, pipeline GitHub Actions và hạ tầng triển khai",
      departmentId: deptEng,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.d@nexcampus.com"],
    },
    {
      name: "Kiểm thử Hệ thống & Tự động hóa",
      description: "Viết kịch bản kiểm thử API và giao diện Cypress/Playwright",
      departmentId: deptQa,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.f@nexcampus.com", "intern.h@nexcampus.com"],
    },
    {
      name: "Thiết kế Design System & Prototype",
      description: "Nghiên cứu UX, xây dựng bộ thư viện UI Kit và Prototype Figma",
      departmentId: deptDesign,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.e@nexcampus.com", "intern.j@nexcampus.com", "intern.k@nexcampus.com"],
    },
    {
      name: "Chiến dịch Content & SEO Mùa Thu",
      description: "Sản xuất nội dung mạng xã hội, video TikTok và tối ưu hóa từ khóa",
      departmentId: deptMkt,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.l@nexcampus.com", "intern.m@nexcampus.com"],
    },
    {
      name: "Quy trình Tuyển dụng & Đào tạo Onboarding",
      description: "Sàng lọc ứng viên, tổ chức phỏng vấn và hướng dẫn thực tập sinh mới",
      departmentId: deptHr,
      status: TaskGroupStatus.ACTIVE,
      memberEmails: ["intern.n@nexcampus.com"],
    },
  ];

  const groupMap: Record<string, string> = {};

  for (const g of groupsData) {
    const group = await prisma.taskGroup.upsert({
      where: {
        name_departmentId: {
          name: g.name,
          departmentId: g.departmentId || "",
        },
      },
      update: { description: g.description, status: g.status },
      create: {
        name: g.name,
        description: g.description,
        departmentId: g.departmentId,
        status: g.status,
      },
    });
    groupMap[g.name] = group.id;

    // Gán thành viên vào nhóm (Bắt buộc để thỏa mãn ràng buộc TaskGroupMember)
    for (const email of g.memberEmails) {
      const internId = interns[email];
      if (internId) {
        await prisma.taskGroupMember.upsert({
          where: {
            taskGroupId_internId: {
              taskGroupId: group.id,
              internId,
            },
          },
          update: {},
          create: {
            taskGroupId: group.id,
            internId,
          },
        });
      }
    }
  }
  console.log(`   ✓ Đã tạo ${Object.keys(groupMap).length} Nhóm công việc kèm thành viên.`);

  // Helper Scenario Builder
  interface ScenarioInput {
    internEmail?: string;
    supportEmail?: string;
    leaderId: string;
    groupName: string;
    code: string;
    title: string;
    desc: string;
    priority: TaskPriority;
    status: AssignmentStatus;
    deadlineOffset: number;
    startOffset?: number;
    estDays?: number;
    blockedReason?: string;
    recreatedFromCode?: string;
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
  }

  const taskCodeMap: Record<string, string> = {}; // code -> taskId

  async function createScenario(input: ScenarioInput) {
    const groupId = groupMap[input.groupName];
    const internId = input.internEmail ? interns[input.internEmail] : null;
    const supportId = input.supportEmail ? interns[input.supportEmail] : null;

    const startDate = getVnDate(input.startOffset ?? input.deadlineOffset - 5, 8, 0);
    const deadline = getVnDate(input.deadlineOffset, 18, 0);

    const task = await prisma.task.create({
      data: {
        taskGroupId: groupId,
        code: input.code,
        title: input.title,
        description: input.desc,
        startDate,
        deadline,
        estDays: input.estDays ?? 2.5,
        priority: input.priority,
        createdBy: input.leaderId,
        acceptanceCriteria: "• Code tuân thủ TypeScript chuẩn strict mode\n• Có unit test bao phủ\n• Đầy đủ tài liệu hướng dẫn và video demo",
        taskNotes: "Lưu ý kiểm tra kỹ xử lý lỗi và transaction an toàn.",
      },
    });
    taskCodeMap[input.code] = task.id;

    // Attach mock file for task
    await prisma.taskAttachment.create({
      data: {
        taskId: task.id,
        fileName: `${input.code}_Specification.pdf`,
        fileUrl: `https://storage.nexcampus.com/tasks/${input.code}_Specification.pdf`,
        filePath: `tasks/${task.id}/specification.pdf`,
        mimeType: "application/pdf",
        fileSize: 245600,
        uploadedBy: input.leaderId,
      },
    });

    // Tạo TaskAssignment
    const isDone = input.status === AssignmentStatus.DONE;
    const completedAt = isDone ? getVnDate(input.deadlineOffset, 17, 0) : null;
    const startedAt = [AssignmentStatus.IN_PROGRESS, AssignmentStatus.REVIEW, AssignmentStatus.DONE, AssignmentStatus.BLOCKED].includes(input.status)
      ? getVnDate(input.deadlineOffset - 3, 9, 0)
      : null;

    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        internId,
        supportId,
        assignedBy: input.leaderId,
        status: input.status,
        blockedReason: input.blockedReason || null,
        startedAt,
        completedAt,
        assignedAt: getVnDate(-30, 8, 0),
      },
    });

    // Tạo TaskSubmissions nếu có
    if (input.submissions && input.submissions.length > 0) {
      for (const sub of input.submissions) {
        const submittedAt = sub.submittedOffsetDays !== undefined
          ? getVnDate(sub.submittedOffsetDays, 16, 45)
          : getVnDate(input.deadlineOffset - 1, 17, 0);

        const reviewedAt = sub.reviewedOffsetDays !== undefined
          ? getVnDate(sub.reviewedOffsetDays, 10, 0)
          : (sub.reviewStatus !== ReviewStatus.PENDING ? getVnDate(input.deadlineOffset, 11, 0) : null);

        const submission = await prisma.taskSubmission.create({
          data: {
            assignmentId: assignment.id,
            attempt: sub.attempt,
            prLink: sub.prLink || `https://github.com/nexcampus/core-api/pull/10${sub.attempt}`,
            videoDemo: sub.videoDemo || "https://www.youtube.com/watch?v=mockdemo",
            note: sub.note || "Em xin phép nộp bài làm ạ.",
            reviewStatus: sub.reviewStatus,
            reviewComment: sub.reviewComment || null,
            reviewedBy: sub.reviewStatus !== ReviewStatus.PENDING ? input.leaderId : null,
            reviewedAt,
            submittedAt,
          },
        });

        // Submission Attachment
        await prisma.submissionAttachment.create({
          data: {
            submissionId: submission.id,
            fileName: `submission_evidence_attempt_${sub.attempt}.png`,
            fileUrl: `https://storage.nexcampus.com/submissions/attempt_${sub.attempt}.png`,
            filePath: `submissions/${submission.id}/evidence.png`,
            mimeType: "image/png",
            fileSize: 512000,
            uploadedBy: internId ? (await prisma.intern.findUnique({ where: { id: internId } }))?.userId || input.leaderId : input.leaderId,
          },
        });
      }
    }
  }

  // ── Scenario 1: Intern A (Top Performer) ──────────────────────────────────
  // 8 tasks DONE, all on time, approved with high praise
  for (let i = 1; i <= 8; i++) {
    await createScenario({
      internEmail: "intern@nexcampus.com",
      leaderId: leaderEngId,
      groupName: "Thực tập Backend & API Core",
      code: `BE-CORE-00${i}`,
      title: `Backend Module ${i}: Thiết kế kiến trúc API Service ${i}`,
      desc: `Xây dựng bộ API xử lý nghiệp vụ module ${i}, kiểm thử và tối ưu hoá câu truy vấn.`,
      priority: i % 2 === 0 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      status: AssignmentStatus.DONE,
      deadlineOffset: -40 + (i * 4), // Rải rác trong quá khứ
      submissions: [
        {
          attempt: 1,
          prLink: `https://github.com/nexcampus/core/pull/20${i}`,
          videoDemo: `https://youtube.com/watch?v=demo20${i}`,
          note: `Đã hoàn thành module ${i}, viết đầy đủ test cases pass 100%.`,
          reviewStatus: ReviewStatus.APPROVED,
          reviewComment: `Code sạch, cấu trúc phân tầng chuẩn, duyệt bài làm module ${i}.`,
          submittedOffsetDays: -40 + (i * 4) - 1,
          reviewedOffsetDays: -40 + (i * 4),
        },
      ],
    });
  }

  // ── Scenario 2: Intern B (Struggling Intern) ───────────────────────────────
  // Task 1: DONE after 3 attempts (REJECTED -> REJECTED -> APPROVED)
  await createScenario({
    internEmail: "intern.b@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-UI-001",
    title: "Frontend Task 1: Thiết lập Axios Interceptors & Authentication Client",
    desc: "Cấu hình HTTP client tự động refresh token khi gặp 401 và xử lý lỗi mạng tập trung.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.DONE,
    deadlineOffset: -20,
    submissions: [
      {
        attempt: 1,
        note: "Em nộp bài lần 1.",
        reviewStatus: ReviewStatus.REJECTED,
        reviewComment: "Chưa xử lý cơ chế retry khi refresh token thất bại, dẫn tới redirect loop.",
        submittedOffsetDays: -22,
        reviewedOffsetDays: -21,
      },
      {
        attempt: 2,
        note: "Em đã sửa lỗi redirect loop.",
        reviewStatus: ReviewStatus.REJECTED,
        reviewComment: "Vẫn thiếu log lỗi ở response error catch và chưa có notification cảnh báo người dùng.",
        submittedOffsetDays: -21,
        reviewedOffsetDays: -20,
      },
      {
        attempt: 3,
        note: "Em đã bổ sung đầy đủ notification và unit test.",
        reviewStatus: ReviewStatus.APPROVED,
        reviewComment: "Tốt, cơ chế xoay vòng token hoạt động mượt mà, approve.",
        submittedOffsetDays: -20,
        reviewedOffsetDays: -19,
      },
    ],
  });

  // Task 2: IN_PROGRESS (Quá hạn 5 ngày)
  await createScenario({
    internEmail: "intern.b@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-UI-002",
    title: "Frontend Task 2: Dựng bảng điều khiển biểu đồ thống kê KPI",
    desc: "Sử dụng Recharts và Tailwind CSS dựng các biểu đồ tiến độ thực tập sinh.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: -5, // Quá hạn 5 ngày!
    startOffset: -12,
  });

  // Task 3: IN_PROGRESS (Quá hạn 2 ngày)
  await createScenario({
    internEmail: "intern.b@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-UI-003",
    title: "Frontend Task 3: Form validate thông tin Onboarding bằng Zod",
    desc: "Dựng form nộp hồ sơ thực tập sinh với Zod validation schema.",
    priority: TaskPriority.MEDIUM,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: -2, // Quá hạn 2 ngày!
    startOffset: -7,
  });

  // Task 4: BLOCKED (Bị kẹt)
  await createScenario({
    internEmail: "intern.b@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-UI-004",
    title: "Frontend Task 4: Tích hợp Webhook Discord nhận thông báo tự động",
    desc: "Kết nối hệ thống báo cáo ngày tới kênh Discord thông báo.",
    priority: TaskPriority.LOW,
    status: AssignmentStatus.BLOCKED,
    blockedReason: "Chưa được cấp tài khoản Discord Bot token và Webhook secret để kiểm thử.",
    deadlineOffset: 3,
  });

  // Task 5: REVIEW (Đang chờ Leader duyệt)
  await createScenario({
    internEmail: "intern.b@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-UI-005",
    title: "Frontend Task 5: Tối ưu hoá tải ảnh bằng Next.js Image Component",
    desc: "Lazy load và tự động nén kích thước ảnh đại diện.",
    priority: TaskPriority.MEDIUM,
    status: AssignmentStatus.REVIEW,
    deadlineOffset: 1,
    submissions: [
      {
        attempt: 1,
        note: "Em đã hoàn tất tối ưu ảnh và cache CDN, kính nhờ anh duyệt giúp em.",
        reviewStatus: ReviewStatus.PENDING,
        submittedOffsetDays: 0, // Nộp hôm nay!
      },
    ],
  });

  // ── Scenario 3: Intern C (Completed Mobile Intern) ─────────────────────────
  for (let i = 1; i <= 4; i++) {
    await createScenario({
      internEmail: "intern.c@nexcampus.com",
      leaderId: leaderEngId,
      groupName: "Thực tập Backend & API Core",
      code: `MOB-C-00${i}`,
      title: `Mobile Task ${i}: Phát triển tính năng React Native Module ${i}`,
      desc: `Xây dựng giao diện và tích hợp API cho module ${i} trên mobile app.`,
      priority: TaskPriority.MEDIUM,
      status: AssignmentStatus.DONE,
      deadlineOffset: -120 + (i * 10),
      submissions: [
        {
          attempt: 1,
          reviewStatus: ReviewStatus.APPROVED,
          reviewComment: "App mượt, hoàn thành tốt.",
          submittedOffsetDays: -120 + (i * 10) - 2,
          reviewedOffsetDays: -120 + (i * 10),
        },
      ],
    });
  }

  // ── Scenario 4: Intern D (Dropped DevOps Intern) ───────────────────────────
  await createScenario({
    internEmail: "intern.d@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập DevOps & CI/CD",
    code: "DO-D-001",
    title: "DevOps Task 1: Thiết lập Docker Compose Multi-Container",
    desc: "Đóng gói ứng dụng backend, database PostgreSQL và Redis.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.DONE,
    deadlineOffset: -40,
    submissions: [
      {
        attempt: 1,
        reviewStatus: ReviewStatus.APPROVED,
        reviewComment: "Docker build nhanh, cấu hình chuẩn.",
        submittedOffsetDays: -42,
        reviewedOffsetDays: -40,
      },
    ],
  });

  await createScenario({
    internEmail: "intern.d@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập DevOps & CI/CD",
    code: "DO-D-002",
    title: "DevOps Task 2: Tự động hoá sao lưu PostgreSQL lên AWS S3",
    desc: "Viết bash script chạy định kỳ backup CSDL.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.TODO, // Bỏ dở không làm
    deadlineOffset: -30,
  });

  // ── Scenario 5: Intern E (New Joiner UI/UX) ───────────────────────────────
  await createScenario({
    internEmail: "intern.e@nexcampus.com",
    leaderId: leaderDesignId,
    groupName: "Thiết kế Design System & Prototype",
    code: "DS-E-001",
    title: "Design Task E1: Nghiên cứu User Flow và vẽ Wireframe Onboarding",
    desc: "Khảo sát trải nghiệm thực tế và dựng wireframe 3 bước tiếp nhận thực tập sinh.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.TODO,
    deadlineOffset: 4,
    startOffset: 0,
  });

  // ── Scenario 6: Intern F (Average QA Intern) ───────────────────────────────
  await createScenario({
    internEmail: "intern.f@nexcampus.com",
    leaderId: leaderQaId,
    groupName: "Kiểm thử Hệ thống & Tự động hóa",
    code: "QA-F-001",
    title: "QA Task 1: Viết kịch bản Test Case cho Module Authentication",
    desc: "Bao phủ các ca kiểm thử: Đăng ký, Đăng nhập, 2FA, Quên mật khẩu.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.DONE,
    deadlineOffset: -25,
    submissions: [
      {
        attempt: 1,
        reviewStatus: ReviewStatus.APPROVED,
        reviewComment: "Test cases chi tiết, tìm được 3 bugs tiềm ẩn.",
        submittedOffsetDays: -26,
        reviewedOffsetDays: -25,
      },
    ],
  });

  await createScenario({
    internEmail: "intern.f@nexcampus.com",
    leaderId: leaderQaId,
    groupName: "Kiểm thử Hệ thống & Tự động hóa",
    code: "QA-F-002",
    title: "QA Task 2: Kiểm thử hồi quy chức năng Nộp báo cáo ngày",
    desc: "Kiểm thử form nộp bài, tệp đính kèm và kiểm tra múi giờ.",
    priority: TaskPriority.MEDIUM,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: 3,
    startOffset: -2,
  });

  // ── Scenario 7: Intern G (Blocked Backend Intern) ──────────────────────────
  await createScenario({
    internEmail: "intern.g@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Backend & API Core",
    code: "BE-G-001",
    title: "Backend Task G1: Tích hợp dịch vụ lưu trữ đám mây Cloudflare R2",
    desc: "Cấu hình S3 Client SDK kết nối Cloudflare R2 để tải lên tệp tin.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.BLOCKED,
    blockedReason: "Đang chờ Admin cấp API Token Cloudflare R2 và Account ID chính thức.",
    deadlineOffset: -1, // Quá hạn và đang bị kẹt!
    startOffset: -6,
  });

  // ── Scenario 8: Intern H (Automation QA with Support from Intern A) ─────────
  await createScenario({
    internEmail: "intern.h@nexcampus.com",
    supportEmail: "intern@nexcampus.com", // Intern A hỗ trợ!
    leaderId: leaderQaId,
    groupName: "Kiểm thử Hệ thống & Tự động hóa",
    code: "QA-H-001",
    title: "Automation Task H1: Viết test tự động Playwright cho luồng Daily Report",
    desc: "Tự động hóa luồng đăng nhập TTS, điền form báo cáo và kiểm tra lịch.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: 5,
    startOffset: -1,
  });

  // ── Scenario 9: Intern I (Junior Frontend) ─────────────────────────────────
  await createScenario({
    internEmail: "intern.i@nexcampus.com",
    leaderId: leaderEngId,
    groupName: "Thực tập Frontend & UI Components",
    code: "FE-I-001",
    title: "Frontend Task I1: Tìm hiểu Design System và bảng màu giao diện",
    desc: "Đọc tài liệu `globals.css` và áp dụng MetalCard, NeonButton.",
    priority: TaskPriority.LOW,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: 2,
    startOffset: -2,
  });

  // ── Scenario 10: Intern J (Design System UI/UX) ────────────────────────────
  await createScenario({
    internEmail: "intern.j@nexcampus.com",
    leaderId: leaderDesignId,
    groupName: "Thiết kế Design System & Prototype",
    code: "DS-J-001",
    title: "Design Task J1: Thiết kế Hi-Fi Mockup màn hình Leader Daily Reports",
    desc: "Thiết kế lịch tháng, bộ lọc trạng thái và modal phản hồi nhận xét.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.REVIEW,
    deadlineOffset: 1,
    submissions: [
      {
        attempt: 1,
        prLink: "https://www.figma.com/file/mock-design-system-nexcampus",
        note: "Em đã hoàn thành file Figma prototype, kính mời Mentor review.",
        reviewStatus: ReviewStatus.PENDING,
        submittedOffsetDays: 0,
      },
    ],
  });

  // ── Scenario 11: Intern K (Completed Graphic Design) ───────────────────────
  for (let i = 1; i <= 6; i++) {
    await createScenario({
      internEmail: "intern.k@nexcampus.com",
      leaderId: leaderDesignId,
      groupName: "Thiết kế Design System & Prototype",
      code: `GD-K-00${i}`,
      title: `Graphic Task K${i}: Thiết kế Banner truyền thông đợt ${i}`,
      desc: `Thiết kế bộ banner Facebook, LinkedIn và poster tuyển dụng đợt ${i}.`,
      priority: TaskPriority.LOW,
      status: AssignmentStatus.DONE,
      deadlineOffset: -100 + (i * 10),
      submissions: [
        {
          attempt: 1,
          reviewStatus: ReviewStatus.APPROVED,
          reviewComment: "Banner đẹp, phối màu sắc nét.",
          submittedOffsetDays: -100 + (i * 10) - 1,
          reviewedOffsetDays: -100 + (i * 10),
        },
      ],
    });
  }

  // ── Scenario 12: Intern L & M (Marketing & SEO) ───────────────────────────
  await createScenario({
    internEmail: "intern.l@nexcampus.com",
    leaderId: leaderMktId,
    groupName: "Chiến dịch Content & SEO Mùa Thu",
    code: "MKT-L-001",
    title: "Marketing Task L1: Lên kịch bản 5 video TikTok hướng nghiệp sinh viên",
    desc: "Viết kịch bản chi tiết chia sẻ kinh nghiệm phỏng vấn thực tập.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.DONE,
    deadlineOffset: -15,
    submissions: [
      {
        attempt: 1,
        reviewStatus: ReviewStatus.APPROVED,
        reviewComment: "Kịch bản viral, ý tưởng sáng tạo xuất sắc.",
        submittedOffsetDays: -16,
        reviewedOffsetDays: -15,
      },
    ],
  });

  await createScenario({
    internEmail: "intern.m@nexcampus.com",
    leaderId: leaderMktId,
    groupName: "Chiến dịch Content & SEO Mùa Thu",
    code: "MKT-M-001",
    title: "SEO Task M1: Phân tích Backlink đối thủ bằng Ahrefs",
    desc: "Lập bảng thống kê 50 backlink chất lượng cao của đối thủ cạnh tranh.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.BLOCKED,
    blockedReason: "Tài khoản Ahrefs công ty đang hết hạn gói Pro, cần gia hạn để xuất báo cáo.",
    deadlineOffset: -3, // Quá hạn và bị chặn
  });

  // ── Scenario 13: Intern N (HR Recruiter) ──────────────────────────────────
  await createScenario({
    internEmail: "intern.n@nexcampus.com",
    leaderId: leaderHrId,
    groupName: "Quy trình Tuyển dụng & Đào tạo Onboarding",
    code: "HR-N-001",
    title: "HR Task N1: Sàng lọc 20 hồ sơ ứng viên vị trí Frontend & Backend",
    desc: "Đánh giá CV theo tiêu chí chuyên môn và liên hệ ứng viên tiềm năng.",
    priority: TaskPriority.HIGH,
    status: AssignmentStatus.IN_PROGRESS,
    deadlineOffset: 4,
    startOffset: -1,
  });

  // ── Scenario 14: Cross-Team Assignment Pending Approval ───────────────────
  // Tech Lead giao 1 task viết tài liệu hướng dẫn kỹ thuật cho Intern N (phòng HR)
  await createScenario({
    internEmail: "intern.n@nexcampus.com",
    leaderId: leaderEngId, // Giao việc xuyên team!
    groupName: "Quy trình Tuyển dụng & Đào tạo Onboarding",
    code: "HR-CROSS-001",
    title: "Cross-Team Task: Soạn thảo cẩm nang kỹ thuật cho buổi định hướng Onboarding",
    desc: "Phối hợp với Tech Lead để biên tập tài liệu hướng dẫn thiết lập máy tính và quy chuẩn code.",
    priority: TaskPriority.MEDIUM,
    status: AssignmentStatus.PENDING_APPROVAL,
    deadlineOffset: 7,
    startOffset: 0,
  });

  // ── Scenario 15: Recreated Task ───────────────────────────────────────────
  // Gắn quan hệ recreated_task_id cho task FE-UI-003 nếu cần minh họa gia hạn task
  const taskFE2 = taskCodeMap["FE-UI-002"];
  const taskFE3 = taskCodeMap["FE-UI-003"];
  if (taskFE2 && taskFE3) {
    await prisma.task.update({
      where: { id: taskFE3 },
      data: { recreatedTaskId: taskFE2 },
    });
  }

  console.log("   ✓ Đã tạo đầy đủ các công việc, bài nộp và phân công (bao quát 100% các trạng thái).");
}
