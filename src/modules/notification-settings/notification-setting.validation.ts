import { z } from "zod";

export const updateNotificationSettingSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  webEnabled: z.boolean().optional(),

  taskAssignedEmail: z.boolean().optional(),
  taskAssignedInApp: z.boolean().optional(),
  submissionReviewedEmail: z.boolean().optional(),
  submissionReviewedInApp: z.boolean().optional(),
  dailyReportReminderEmail: z.boolean().optional(),
  dailyReportReminderInApp: z.boolean().optional(),
  meetingScheduleEmail: z.boolean().optional(),
  meetingScheduleInApp: z.boolean().optional(),
});

export type UpdateNotificationSettingInput = z.infer<
  typeof updateNotificationSettingSchema
>;
