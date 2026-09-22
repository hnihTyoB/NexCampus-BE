import {
  PrismaClient,
  MeetingType,
  MeetingStatus,
  MeetingVisibility,
  ParticipantRole,
  InvitationStatus,
  AttendanceStatus,
  AbsenceStatus,
} from "@prisma/client";
import { getVnDate } from "./helper";

export async function seedMeetings(
  prisma: PrismaClient,
  internUsers: Record<string, string>,
  leaders: Record<string, string>,
  deptMap: Record<string, string>
) {
  console.log("\n[7/8] Khởi tạo Lịch họp & Điểm danh (Meetings & Attendance)...");

  const leaderEngId = leaders["leader@nexcampus.com"];
  const leaderQaId = leaders["leader.qa@nexcampus.com"];
  const leaderDesignId = leaders["leader.design@nexcampus.com"];
  const leaderHrId = leaders["leader.hr@nexcampus.com"];

  const deptEng = deptMap["Kỹ thuật phần mềm (Software Engineering)"];
  const deptDesign = deptMap["Thiết kế sản phẩm (UI/UX)"];
  const deptHr = deptMap["Nhân sự & Đào tạo (HR)"];

  // ── 1. Meetings ───────────────────────────────────────────────────────────

  // Meeting 1: COMPLETED (5 ngày trước)
  const m1 = await prisma.meeting.create({
    data: {
      title: "[Engineering] Weekly Sync - Cập nhật tiến độ Sprint 3",
      description: "Họp cập nhật tiến độ công việc, review kiến trúc API và tháo gỡ vướng mắc kỹ thuật.",
      minutes: `
        <h3>BIÊN BẢN CUỘC HỌP GIAO BAN KỸ THUẬT</h3>
        <p><strong>Thời gian:</strong> 09:00 - 10:30 (Thứ Hai)</p>
        <p><strong>Chủ trì:</strong> Đỗ Hoàng Long (Tech Lead)</p>
        <p><strong>Nội dung chính:</strong></p>
        <ul>
          <li>Nguyễn Văn Thực Tập Sinh hoàn thành xuất sắc các API Core, chuẩn bị chuyển sang module caching.</li>
          <li>Trần Thị Bình gặp vướng mắc về CSS responsive và Axios Interceptor, Tech Lead đã chỉ dẫn hướng sửa.</li>
          <li>Phạm Quỳnh Chi vắng mặt không phép, HR sẽ liên hệ xác minh.</li>
        </ul>
      `,
      createdBy: leaderEngId,
      hostId: leaderEngId,
      location: "Kênh Discord / Google Meet",
      meetingType: MeetingType.ONLINE,
      meetingLink: "https://meet.google.com/nex-camp-eng",
      startTime: getVnDate(-5, 9, 0),
      endTime: getVnDate(-5, 10, 30),
      departmentId: deptEng,
      status: MeetingStatus.COMPLETED,
      visibility: MeetingVisibility.TEAM,
    },
  });

  // Participants Meeting 1
  const m1Participants = [
    { email: "leader@nexcampus.com", role: ParticipantRole.HOST, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
    { email: "intern@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
    { email: "intern.b@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.DECLINED, att: AttendanceStatus.ABSENT, hasAbsence: true },
    { email: "intern.c@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
    { email: "intern.d@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ABSENT }, // Vắng không phép
  ];

  for (const p of m1Participants) {
    const userId = p.email.startsWith("leader") ? leaders[p.email] : internUsers[p.email];
    if (!userId) continue;

    const mp = await prisma.meetingParticipant.create({
      data: {
        meetingId: m1.id,
        userId,
        participantRole: p.role,
        invitationStatus: p.inv,
        attendanceStatus: p.att,
        responseAt: getVnDate(-6, 15, 0),
        joinedAt: p.att === AttendanceStatus.ATTENDED ? getVnDate(-5, 8, 58) : null,
        leftAt: p.att === AttendanceStatus.ATTENDED ? getVnDate(-5, 10, 32) : null,
      },
    });

    // Nếu có đơn xin vắng mặt họp (Intern B xin phép trước)
    if (p.hasAbsence) {
      await prisma.absenceRequest.create({
        data: {
          meetingId: m1.id,
          participantId: mp.id,
          reason: "Dạ thưa anh, sáng nay em có lịch khám bệnh định kỳ tại bệnh viện nên em xin phép vắng mặt buổi họp tuần này ạ.",
          attachmentUrl: "https://storage.nexcampus.com/absences/giay_kham_benh.pdf",
          status: AbsenceStatus.APPROVED,
          reviewedBy: leaderEngId,
          reviewedAt: getVnDate(-5, 8, 30),
          reviewNote: "Đã duyệt. Em nhớ cập nhật lại biên bản cuộc họp từ các bạn khác nhé.",
        },
      });
    }
  }

  // Meeting 2: COMPLETED (Offline Onboarding HR - 10 ngày trước)
  const m2 = await prisma.meeting.create({
    data: {
      title: "[HR] Định hướng văn hóa doanh nghiệp & Quy chế thực tập",
      description: "Chào mừng các bạn thực tập sinh mới, phổ biến nội quy công ty và hướng dẫn bàn giao thiết bị.",
      minutes: "Đã phổ biến đầy đủ nội quy thực tập, 100% TTS tham gia đã ký cam kết bảo mật.",
      createdBy: leaderHrId,
      hostId: leaderHrId,
      location: "Phòng họp Lớn - Tầng 2, Trụ sở NexCampus",
      meetingType: MeetingType.OFFLINE,
      startTime: getVnDate(-10, 14, 0),
      endTime: getVnDate(-10, 16, 0),
      departmentId: deptHr,
      status: MeetingStatus.COMPLETED,
      visibility: MeetingVisibility.TEAM,
    },
  });

  const m2Participants = [
    { email: "leader.hr@nexcampus.com", role: ParticipantRole.HOST },
    { email: "intern.n@nexcampus.com", role: ParticipantRole.PARTICIPANT },
    { email: "intern.e@nexcampus.com", role: ParticipantRole.PARTICIPANT },
  ];

  for (const p of m2Participants) {
    const userId = p.email.startsWith("leader") ? leaders[p.email] : internUsers[p.email];
    if (!userId) continue;
    await prisma.meetingParticipant.create({
      data: {
        meetingId: m2.id,
        userId,
        participantRole: p.role,
        invitationStatus: InvitationStatus.ACCEPTED,
        attendanceStatus: AttendanceStatus.ATTENDED,
        responseAt: getVnDate(-11, 9, 0),
      },
    });
  }

  // Meeting 3: SCHEDULED (Ngày mai - Sắp diễn ra)
  const m3 = await prisma.meeting.create({
    data: {
      title: "[Engineering] Sprint Planning & Phân chia công việc Sprint 4",
      description: "Lên kế hoạch sprint tiếp theo, ước lượng ngày công (estDays) và phân bổ task cho các bạn TTS.",
      createdBy: leaderEngId,
      hostId: leaderEngId,
      location: "Google Meet",
      meetingType: MeetingType.ONLINE,
      meetingLink: "https://meet.google.com/nex-sprint-plan",
      startTime: getVnDate(1, 9, 0), // Ngày mai 09:00
      endTime: getVnDate(1, 10, 30),
      departmentId: deptEng,
      status: MeetingStatus.SCHEDULED,
      visibility: MeetingVisibility.TEAM,
    },
  });

  const m3Participants = [
    { email: "leader@nexcampus.com", role: ParticipantRole.HOST, inv: InvitationStatus.ACCEPTED },
    { email: "intern@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED },
    { email: "intern.b@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.PENDING },
    { email: "intern.i@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED },
  ];

  for (const p of m3Participants) {
    const userId = p.email.startsWith("leader") ? leaders[p.email] : internUsers[p.email];
    if (!userId) continue;
    await prisma.meetingParticipant.create({
      data: {
        meetingId: m3.id,
        userId,
        participantRole: p.role,
        invitationStatus: p.inv,
        attendanceStatus: AttendanceStatus.UNKNOWN,
      },
    });
  }

  // Meeting 4: ONGOING (Đang diễn ra hôm nay)
  const m4 = await prisma.meeting.create({
    data: {
      title: "[Design] Đánh giá giao diện UI Kit & Trải nghiệm Dashboard",
      description: "Thảo luận chi tiết về components Design System, màu sắc dark/light mode và icon set.",
      createdBy: leaderDesignId,
      hostId: leaderDesignId,
      location: "Phòng Design Lab & Google Meet",
      meetingType: MeetingType.HYBRID,
      meetingLink: "https://meet.google.com/nex-design-review",
      startTime: getVnDate(0, 13, 0), // Hôm nay 13:00 - 15:00
      endTime: getVnDate(0, 15, 0),
      departmentId: deptDesign,
      status: MeetingStatus.ONGOING,
      visibility: MeetingVisibility.TEAM,
    },
  });

  const m4Participants = [
    { email: "leader.design@nexcampus.com", role: ParticipantRole.HOST, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
    { email: "intern.j@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
    { email: "intern.e@nexcampus.com", role: ParticipantRole.PARTICIPANT, inv: InvitationStatus.ACCEPTED, att: AttendanceStatus.ATTENDED },
  ];

  for (const p of m4Participants) {
    const userId = p.email.startsWith("leader") ? leaders[p.email] : internUsers[p.email];
    if (!userId) continue;
    await prisma.meetingParticipant.create({
      data: {
        meetingId: m4.id,
        userId,
        participantRole: p.role,
        invitationStatus: p.inv,
        attendanceStatus: p.att,
        joinedAt: getVnDate(0, 13, 2),
      },
    });
  }

  // Meeting 5: CANCELLED (Cuộc họp đã bị hủy)
  await prisma.meeting.create({
    data: {
      title: "[All-Hands] Chia sẻ kinh nghiệm công nghệ tháng 9",
      description: "Buổi seminar kỹ thuật về ứng dụng Trí tuệ nhân tạo (AI) trong lập trình.",
      createdBy: leaderEngId,
      hostId: leaderEngId,
      location: "Hội trường A",
      meetingType: MeetingType.OFFLINE,
      startTime: getVnDate(-2, 16, 0),
      endTime: getVnDate(-2, 17, 30),
      status: MeetingStatus.CANCELLED,
      visibility: MeetingVisibility.TEAM,
    },
  });

  // Meeting 6: DRAFT (Bản nháp)
  await prisma.meeting.create({
    data: {
      title: "[Draft] Kế hoạch đào tạo an toàn thông tin quý 4",
      description: "Nội dung chuẩn bị cho khóa huấn luyện bảo mật.",
      createdBy: leaderQaId,
      hostId: leaderQaId,
      location: "Chưa xác định",
      meetingType: MeetingType.ONLINE,
      startTime: getVnDate(14, 10, 0),
      endTime: getVnDate(14, 11, 30),
      status: MeetingStatus.DRAFT,
      visibility: MeetingVisibility.PRIVATE,
    },
  });

  console.log("   ✓ Đã tạo 6 cuộc họp (Completed, Scheduled, Ongoing, Cancelled, Draft) kèm điểm danh.");
}
