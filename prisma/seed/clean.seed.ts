import { PrismaClient } from "@prisma/client";

/**
 * Safely cleans all demo database records in reverse foreign key order.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  console.log("-> [Clean] Đang làm sạch các bản ghi dữ liệu cũ...");

  const tables = [
    { name: "ExportHistory", fn: () => prisma.exportHistory.deleteMany() },
    { name: "AuditLog", fn: () => prisma.auditLog.deleteMany() },
    { name: "UserSocial", fn: () => prisma.userSocial.deleteMany() },
    { name: "RefreshToken", fn: () => prisma.refreshToken.deleteMany() },
    { name: "VerificationToken", fn: () => prisma.verificationToken.deleteMany() },
    { name: "PasswordResetToken", fn: () => prisma.passwordResetToken.deleteMany() },
    { name: "UserDevice", fn: () => prisma.userDevice.deleteMany() },
    { name: "Notification", fn: () => prisma.notification.deleteMany() },
    { name: "EmailNotification", fn: () => prisma.emailNotification.deleteMany() },
    { name: "NotificationSetting", fn: () => prisma.notificationSetting.deleteMany() },
    { name: "WebhookDelivery", fn: () => prisma.webhookDelivery.deleteMany() },
    { name: "WebhookEndpoint", fn: () => prisma.webhookEndpoint.deleteMany() },
    { name: "ApiKey", fn: () => prisma.apiKey.deleteMany() },
    { name: "RegulationAcknowledgment", fn: () => prisma.regulationAcknowledgment.deleteMany() },
    { name: "ReportAttachment", fn: () => prisma.reportAttachment.deleteMany() },
    { name: "DailyReport", fn: () => prisma.dailyReport.deleteMany() },
    { name: "WeeklyEvaluation", fn: () => prisma.weeklyEvaluation.deleteMany() },
    { name: "SubmissionAttachment", fn: () => prisma.submissionAttachment.deleteMany() },
    { name: "TaskSubmission", fn: () => prisma.taskSubmission.deleteMany() },
    { name: "TaskAssignment", fn: () => prisma.taskAssignment.deleteMany() },
    { name: "TaskAttachment", fn: () => prisma.taskAttachment.deleteMany() },
    { name: "Task (Dependencies & Self-relations)", fn: () => prisma.$executeRawUnsafe(`UPDATE tasks SET recreated_task_id = NULL;`) },
    { name: "Task", fn: () => prisma.task.deleteMany() },
    { name: "TaskGroupMember", fn: () => prisma.taskGroupMember.deleteMany() },
    { name: "TaskGroup", fn: () => prisma.taskGroup.deleteMany() },
    { name: "AbsenceRequest", fn: () => prisma.absenceRequest.deleteMany() },
    { name: "Absence", fn: () => prisma.absence.deleteMany() },
    { name: "MeetingParticipant", fn: () => prisma.meetingParticipant.deleteMany() },
    { name: "Meeting", fn: () => prisma.meeting.deleteMany() },
    { name: "ApplicationAttachment", fn: () => prisma.applicationAttachment.deleteMany() },
    { name: "ApplicationInvite", fn: () => prisma.applicationInvite.deleteMany() },
    { name: "Application", fn: () => prisma.application.deleteMany() },
    { name: "Regulation", fn: () => prisma.regulation.deleteMany() },
    { name: "Intern", fn: () => prisma.intern.deleteMany() },
    { name: "LeaderDepartment", fn: () => prisma.leaderDepartment.deleteMany() },
    { name: "Leader", fn: () => prisma.leader.deleteMany() },
    { name: "Position", fn: () => prisma.position.deleteMany() },
    { name: "Department", fn: () => prisma.department.deleteMany() },
    { name: "RolePermission", fn: () => prisma.rolePermission.deleteMany() },
    { name: "User", fn: () => prisma.user.deleteMany() },
    { name: "Role", fn: () => prisma.role.deleteMany() },
    { name: "Permission", fn: () => prisma.permission.deleteMany() },
    { name: "SystemSetting", fn: () => prisma.systemSetting.deleteMany() },
    { name: "MaintenanceConfig", fn: () => prisma.maintenanceConfig.deleteMany() },
    { name: "NotificationTemplate", fn: () => prisma.notificationTemplate.deleteMany() },
    { name: "SystemConfig", fn: () => prisma.systemConfig.deleteMany() },
  ];

  for (const t of tables) {
    try {
      await t.fn();
    } catch (err: any) {
      console.warn(`   ! Cảnh báo khi làm sạch bảng ${t.name}:`, err.message);
    }
  }

  console.log("   ✓ Đã làm sạch toàn bộ dữ liệu demo cũ.");
}
