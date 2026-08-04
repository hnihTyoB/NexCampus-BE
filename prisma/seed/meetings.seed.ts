import { PrismaClient, MeetingType, MeetingStatus, ParticipantRole, InvitationStatus, AttendanceStatus, AbsenceStatus, ApplicationStatus, ApplicationInviteStatus } from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedMeetingsAndRelations(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string> // email -> user.id
): Promise<void> {
  console.log("-> Seeding Meetings, Applications, Invites, Logs, Exports...");

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@nexcampus.local" } });
  const adminId = adminUser?.id || null;

  const leader1Id = leaders["leader1@nexcampus.local"];
  const leader2Id = leaders["leader2@nexcampus.local"];
  const leader3Id = leaders["leader3@nexcampus.local"];
  const leader4Id = leaders["leader4@nexcampus.local"];

  // Lấy User IDs of interns
  const internUsers = await prisma.intern.findMany({
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
    }
  });

  const getInternUserId = (email: string) => {
    return internUsers.find(iu => iu.user.email === email)?.userId || null;
  };

  const getInternProfileId = (email: string) => {
    return internUsers.find(iu => iu.user.email === email)?.id || null;
  };

  const regulation = await prisma.regulation.findFirst();

  // ==========================================
  // 1. Seed Applications & Invites
  // ==========================================
  const appPending = await prisma.application.create({
    data: {
      fullName: "Đoàn Minh Hải",
      email: "doanminhhai@gmail.com",
      phone: "0999888777",
      preferredDepartment: "Kỹ thuật Công nghệ",
      preferredPosition: "Thực tập sinh Backend",
      startDate: getVnDate(14, 8, 0), // Bắt đầu sau 14 ngày
      duration: 3,
      status: "PENDING" as ApplicationStatus,
    }
  });

  // Attach CV for pending application
  await prisma.applicationAttachment.create({
    data: {
      applicationId: appPending.id,
      fileName: "CV_DoanMinhHai_Backend.pdf",
      fileUrl: "https://supabase.co/storage/cv_doanminhhai_backend.pdf",
      filePath: "cv/cv_doanminhhai_backend.pdf",
      mimeType: "application/pdf",
      fileSize: 102450,
    }
  });

  // Application approved (đã dùng để tạo Intern A)
  const appApproved = await prisma.application.create({
    data: {
      fullName: "Nguyễn Văn Anh",
      email: "intern.a@nexcampus.local",
      phone: "0911111111",
      preferredDepartment: "Kỹ thuật Công nghệ",
      preferredPosition: "Thực tập sinh Backend",
      startDate: getVnDate(-28, 8, 0),
      duration: 3,
      status: "APPROVED" as ApplicationStatus,
      approvedBy: leader1Id,
      approvedAt: getVnDate(-29, 10, 0),
      regulationId: regulation?.id || null,
      acceptedAt: getVnDate(-29, 10, 0), // Chấp nhận quy chế
    }
  });

  // Application rejected
  await prisma.application.create({
    data: {
      fullName: "Trần Văn Cường",
      email: "cuongtran@gmail.com",
      phone: "0999555444",
      preferredDepartment: "Marketing",
      preferredPosition: "Thực tập sinh SEO",
      startDate: getVnDate(7, 8, 0),
      duration: 3,
      status: "REJECTED" as ApplicationStatus,
      approvedBy: leader3Id,
      approvedAt: getVnDate(-5, 10, 0),
    }
  });

  // Application Invites
  await prisma.applicationInvite.createMany({
    data: [
      {
        email: "invite.active@gmail.com",
        token: "token_invite_active_123",
        status: "ACTIVE" as ApplicationInviteStatus,
        expiresAt: getVnDate(1, 12, 0), // Còn hạn
        createdBy: adminId,
      },
      {
        email: "intern.a@nexcampus.local",
        token: "token_invite_used_456",
        status: "USED" as ApplicationInviteStatus,
        expiresAt: getVnDate(-28, 12, 0),
        usedAt: getVnDate(-29, 10, 0),
        applicationId: appApproved.id,
        createdBy: leader1Id,
      },
      {
        email: "invite.expired@gmail.com",
        token: "token_invite_expired_789",
        status: "EXPIRED" as ApplicationInviteStatus,
        expiresAt: getVnDate(-5, 12, 0),
        createdBy: adminId,
      },
      {
        email: "invite.revoked@gmail.com",
        token: "token_invite_revoked_000",
        status: "REVOKED" as ApplicationInviteStatus,
        expiresAt: getVnDate(5, 12, 0),
        createdBy: adminId,
      }
    ]
  });
  console.log("   ✓ Applications & Invites seeded.");

  // ==========================================
  // 2. Seed Meetings
  // ==========================================
  // Meeting 1: Weekly Sync Kỹ thuật (Leader 1 host) - Xảy ra cách đây 5 ngày
  const m1 = await prisma.meeting.create({
    data: {
      title: "[Engineering] Weekly Sync - Tuần 3",
      description: "Họp cập nhật tiến độ công việc, review code và tháo gỡ khó khăn kỹ thuật.",
      createdBy: leader1Id!,
      hostId: leader1Id!,
      location: "Kênh Discord / Google Meet",
      meetingType: "ONLINE" as MeetingType,
      meetingLink: "https://meet.google.com/abc-xyz-123",
      startTime: getVnDate(-5, 9, 0), // 5 ngày trước, lúc 9:00 sáng
      endTime: getVnDate(-5, 10, 0), // kết thúc lúc 10:00 sáng
      status: "COMPLETED" as MeetingStatus,
    }
  });

  // Mời các thành viên phòng Kỹ thuật
  const devGroup = [
    { email: "intern.a@nexcampus.local", status: "ACCEPTED", attend: "ATTENDED" },
    { email: "intern.b@nexcampus.local", status: "DECLINED", attend: "UNKNOWN" }, // xin nghỉ phép
    { email: "intern.c@nexcampus.local", status: "ACCEPTED", attend: "ATTENDED" },
    { email: "intern.d@nexcampus.local", status: "ACCEPTED", attend: "ABSENT" }, // vắng không lý do
  ];

  for (const member of devGroup) {
    const userId = getInternUserId(member.email);
    if (!userId) continue;

    const mp = await prisma.meetingParticipant.create({
      data: {
        meetingId: m1.id,
        userId,
        participantRole: "PARTICIPANT" as ParticipantRole,
        invitationStatus: member.status as InvitationStatus,
        attendanceStatus: member.attend as AttendanceStatus,
        responseAt: getVnDate(-6, 14, 0),
      }
    });

    // Nếu Intern B declined -> Tạo đơn xin nghỉ phép
    if (member.email === "intern.b@nexcampus.local") {
      await prisma.absenceRequest.create({
        data: {
          meetingId: m1.id,
          participantId: mp.id,
          reason: "Dạ thưa anh, sáng nay em có lịch khám bệnh định kỳ tại bệnh viện nên em xin phép vắng mặt buổi họp tuần này ạ.",
          status: "APPROVED" as AbsenceStatus,
          reviewedBy: leader1Id,
          reviewedAt: getVnDate(-5, 8, 30), // được duyệt trước giờ họp 30p
          reviewNote: "Đã duyệt. Nhớ cập nhật lại nội dung buổi họp từ các bạn khác nhé.",
        }
      });
    }
  }

  // Meeting 2: Offline Onboarding HR (Leader 4 host) - Xảy ra cách đây 10 ngày
  const m2 = await prisma.meeting.create({
    data: {
      title: "[HR] Định hướng thực tập sinh mới",
      description: "Chào mừng các bạn mới, phổ biến quy chế công ty và hướng dẫn onboard hệ thống.",
      createdBy: leader4Id!,
      hostId: leader4Id!,
      location: "Phòng họp Lớn - Tầng 2",
      meetingType: "OFFLINE" as MeetingType,
      startTime: getVnDate(-10, 14, 0), // 10 ngày trước, lúc 14:00 chiều
      endTime: getVnDate(-10, 15, 30),
      status: "COMPLETED" as MeetingStatus,
    }
  });

  const hrGroup = [
    { email: "intern.g@nexcampus.local" },
    { email: "intern.n@nexcampus.local" }
  ];

  for (const member of hrGroup) {
    const userId = getInternUserId(member.email);
    if (!userId) continue;

    await prisma.meetingParticipant.create({
      data: {
        meetingId: m2.id,
        userId,
        participantRole: "PARTICIPANT" as ParticipantRole,
        invitationStatus: "ACCEPTED" as InvitationStatus,
        attendanceStatus: "ATTENDED" as AttendanceStatus,
        responseAt: getVnDate(-11, 9, 0),
      }
    });
  }
  console.log("   ✓ Meetings, Participants, Absence requests seeded.");

  // ==========================================
  // 3. Seed Export Histories
  // ==========================================
  const internCProfileId = getInternProfileId("intern.c@nexcampus.local");
  if (internCProfileId && adminId) {
    await prisma.exportHistory.create({
      data: {
        type: "INTERN_REPORT",
        entityType: "INTERN",
        entityId: internCProfileId,
        fileName: "intern_c_final_evaluation_report.pdf",
        storagePath: "exports/intern_c_final_evaluation_report.pdf",
        fileUrl: "https://supabase.co/storage/intern_c_final_evaluation_report.pdf",
        createdById: adminId,
        expiresAt: getVnDate(30, 0, 0), // Hết hạn sau 30 ngày kể từ khi seed
        createdAt: getVnDate(-30, 17, 0), // Tạo cách đây 30 ngày
      }
    });
  }
  console.log("   ✓ Export histories seeded.");

  // ==========================================
  // 4. Seed Activity Logs
  // ==========================================
  const logs = [
    { email: "admin@nexcampus.local", action: "CREATE_USER", desc: "Tạo tài khoản thực tập sinh mới: intern.i@nexcampus.local", offset: -7 },
    { email: "admin@nexcampus.local", action: "UPDATE_SYSTEM_SETTINGS", desc: "Cập nhật giới hạn file upload lên 50MB", offset: -30 },
    
    { email: "leader1@nexcampus.local", action: "CREATE_TASK", desc: "Tạo công việc mới: Xây dựng API resource", offset: -25 },
    { email: "leader1@nexcampus.local", action: "ASSIGN_TASK", desc: "Giao task BE-A-001 cho Nguyễn Văn Anh", offset: -24 },
    { email: "leader1@nexcampus.local", action: "REVIEW_SUBMISSION", desc: "Duyệt bài nộp lần 1 của Nguyễn Văn Anh cho task BE-A-001 - APPROVED", offset: -23 },
    { email: "leader1@nexcampus.local", action: "SUBMIT_WEEKLY_EVALUATION", desc: "Hoàn tất đánh giá tuần 1 cho Nguyễn Văn Anh", offset: -21 },

    { email: "intern.a@nexcampus.local", action: "SUBMIT_DAILY_REPORT", desc: "Gửi báo cáo công việc hàng ngày đúng giờ", offset: -3 },
    { email: "intern.a@nexcampus.local", action: "SUBMIT_TASK_SUBMISSION", desc: "Nộp bài cho công việc: BE-A-008", offset: -2 },
  ];

  const logsToInsert = [];
  for (const log of logs) {
    let userId = null;
    if (log.email === "admin@nexcampus.local" && adminId) {
      userId = adminId;
    } else if (log.email.startsWith("leader") && leaders[log.email]) {
      userId = leaders[log.email];
    } else {
      userId = getInternUserId(log.email);
    }

    if (!userId) continue;

    logsToInsert.push({
      userId,
      action: log.action,
      description: log.desc,
      createdAt: getVnDate(log.offset, 10, 0),
    });
  }

  await prisma.activityLog.createMany({
    data: logsToInsert,
  });
  console.log("   ✓ Activity logs seeded.");
}
