export interface NotificationSettingDto {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webEnabled: boolean;

  // Event-specific preferences
  taskAssignedEmail: boolean;
  taskAssignedInApp: boolean;
  submissionReviewedEmail: boolean;
  submissionReviewedInApp: boolean;
  dailyReportReminderEmail: boolean;
  dailyReportReminderInApp: boolean;
  meetingScheduleEmail: boolean;
  meetingScheduleInApp: boolean;

  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UpdateNotificationSettingDto {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  webEnabled?: boolean;

  taskAssignedEmail?: boolean;
  taskAssignedInApp?: boolean;
  submissionReviewedEmail?: boolean;
  submissionReviewedInApp?: boolean;
  dailyReportReminderEmail?: boolean;
  dailyReportReminderInApp?: boolean;
  meetingScheduleEmail?: boolean;
  meetingScheduleInApp?: boolean;
}
