import {
  PrismaClient,
  ApplicationStatus,
  ApplicationInviteStatus,
} from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedRecruitment(
  prisma: PrismaClient,
  adminId: string,
  leaders: Record<string, string>,
  deptMap: Record<string, string>,
  posMap: Record<string, string>,
  regulationId: string | null
): Promise<void> {
  console.log("\n[8/8] Khởi tạo Tuyển dụng & Tiếp nhận (Applications & Invites)...");

  const leaderEngId = leaders["leader@nexcampus.com"];
  const leaderMktId = leaders["leader.mkt@nexcampus.com"];

  const deptEng = deptMap["Kỹ thuật phần mềm (Software Engineering)"];
  const posBe = posMap["Kỹ thuật phần mềm (Software Engineering):Backend Intern"];
  const deptDesign = deptMap["Thiết kế sản phẩm (UI/UX)"];
  const posUi = posMap["Thiết kế sản phẩm (UI/UX):UI/UX Intern"];

  // 1. Application: PENDING
  const app1 = await prisma.application.create({
    data: {
      fullName: "Đoàn Minh Hải",
      email: "doanminhhai.candidate@gmail.com",
      phone: "0999888777",
      university: "Đại học Công nghệ Giao thông Vận tải",
      major: "Công nghệ thông tin",
      preferredDepartment: "Kỹ thuật phần mềm",
      preferredPosition: "Backend Intern",
      departmentId: deptEng,
      positionId: posBe,
      startDate: getVnDate(14, 8, 0), // 14 ngày nữa bắt đầu
      duration: 3,
      status: ApplicationStatus.PENDING,
    },
  });

  await prisma.applicationAttachment.create({
    data: {
      applicationId: app1.id,
      fileName: "CV_DoanMinhHai_Backend.pdf",
      fileUrl: "https://storage.nexcampus.com/applications/cv_doanminhhai_backend.pdf",
      filePath: `applications/${app1.id}/cv_doanminhhai_backend.pdf`,
      mimeType: "application/pdf",
      fileSize: 154000,
    },
  });

  // 2. Application: APPROVED (Đã duyệt cho Intern A)
  const app2 = await prisma.application.create({
    data: {
      fullName: "Nguyễn Văn Thực Tập Sinh",
      email: "intern@nexcampus.com",
      phone: "0911111111",
      university: "Đại học Bách Khoa Hà Nội",
      major: "Công nghệ thông tin",
      preferredDepartment: "Kỹ thuật phần mềm",
      preferredPosition: "Backend Intern",
      departmentId: deptEng,
      positionId: posBe,
      startDate: getVnDate(-52, 8, 0),
      duration: 3,
      status: ApplicationStatus.APPROVED,
      approvedBy: leaderEngId,
      approvedAt: getVnDate(-53, 14, 0),
      regulationId,
      acceptedAt: getVnDate(-53, 15, 0),
    },
  });

  // 3. Application: REJECTED
  await prisma.application.create({
    data: {
      fullName: "Trần Văn Cường",
      email: "cuongtran.candidate@gmail.com",
      phone: "0999555444",
      university: "Đại học Kinh doanh và Công nghệ",
      major: "Quản trị kinh doanh",
      preferredDepartment: "Marketing",
      preferredPosition: "SEO Specialist Intern",
      startDate: getVnDate(7, 8, 0),
      duration: 3,
      status: ApplicationStatus.REJECTED,
      rejectedBy: leaderMktId,
      rejectedAt: getVnDate(-5, 10, 0),
      rejectedReason: "Hồ sơ ứng viên chưa đạt các yêu cầu tối thiểu về kiến thức kỹ thuật SEO và On-page.",
    },
  });

  // 4. Application: PENDING (UI/UX)
  const app4 = await prisma.application.create({
    data: {
      fullName: "Lê Thị Mai",
      email: "maile.candidate@gmail.com",
      phone: "0999333222",
      university: "Đại học Mỹ thuật Công nghiệp",
      major: "Thiết kế đồ họa",
      preferredDepartment: "Thiết kế sản phẩm",
      preferredPosition: "UI/UX Intern",
      departmentId: deptDesign,
      positionId: posUi,
      startDate: getVnDate(10, 8, 0),
      duration: 3,
      status: ApplicationStatus.PENDING,
    },
  });

  await prisma.applicationAttachment.create({
    data: {
      applicationId: app4.id,
      fileName: "Portfolio_MaiLe_UIUX.pdf",
      fileUrl: "https://storage.nexcampus.com/applications/portfolio_maile_uiux.pdf",
      filePath: `applications/${app4.id}/portfolio_maile.pdf`,
      mimeType: "application/pdf",
      fileSize: 4200000,
    },
  });

  // ── Application Invites ───────────────────────────────────────────────────
  await prisma.applicationInvite.createMany({
    data: [
      {
        email: "invite.active@gmail.com",
        token: "token_invite_active_valid_9999",
        status: ApplicationInviteStatus.ACTIVE,
        expiresAt: getVnDate(7, 12, 0), // Còn hạn 7 ngày
        createdBy: adminId,
      },
      {
        email: "intern@nexcampus.com",
        token: "token_invite_used_already_8888",
        status: ApplicationInviteStatus.USED,
        expiresAt: getVnDate(-50, 12, 0),
        usedAt: getVnDate(-53, 10, 0),
        applicationId: app2.id,
        createdBy: leaderEngId,
      },
      {
        email: "invite.expired@gmail.com",
        token: "token_invite_expired_outdated_7777",
        status: ApplicationInviteStatus.EXPIRED,
        expiresAt: getVnDate(-3, 12, 0), // Đã quá hạn 3 ngày
        createdBy: adminId,
      },
      {
        email: "invite.revoked@gmail.com",
        token: "token_invite_revoked_by_admin_6666",
        status: ApplicationInviteStatus.REVOKED,
        expiresAt: getVnDate(5, 12, 0),
        createdBy: adminId,
      },
    ],
  });

  console.log("   ✓ Đã tạo 4 đơn ứng tuyển (Pending, Approved, Rejected) và 4 thư mời tuyển dụng.");
}
