export interface ReportAttachmentDto {
  id: string;
  reportId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date | string;
}

export interface DailyReportDto {
  id: string;
  internId: string;
  date: Date | string;
  content: string;
  blockers: string | null;
  nextPlan: string | null;
  hoursWorked: number | null;
  prLink: string | null;
  videoDemo: string | null;
  feedback: string | null;
  feedbackBy: string | null;
  feedbackAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  intern?: {
    id: string;
    fullName: string;
    phone?: string;
    internCode?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
    position?: {
      id: string;
      name: string;
    } | null;
    user?: {
      id: string;
      email: string;
      fullName: string | null;
      avatarUrl?: string | null;
    };
  };
  feedbackUser?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  attachments?: ReportAttachmentDto[];
}

export interface CreateReportAttachmentInput {
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export interface CreateDailyReportDto {
  internId?: string;
  date?: string; // YYYY-MM-DD (defaults to today in Vietnam time)
  content: string;
  blockers?: string | null;
  nextPlan?: string | null;
  hoursWorked?: number | null;
  prLink?: string | null;
  videoDemo?: string | null;
  attachments?: CreateReportAttachmentInput[];
}

export interface UpdateDailyReportDto {
  content?: string;
  blockers?: string | null;
  nextPlan?: string | null;
  hoursWorked?: number | null;
  prLink?: string | null;
  videoDemo?: string | null;
  attachments?: CreateReportAttachmentInput[];
}

export interface DailyReportFeedbackDto {
  feedback: string;
}

export interface DailyReportQueryDto {
  page?: number;
  limit?: number;
  date?: string;
  from?: string;
  to?: string;
  internId?: string;
  departmentId?: string;
  sortBy?: "date" | "createdAt" | "hoursWorked";
  order?: "asc" | "desc";
}

export interface DailyReportCalendarQueryDto {
  month: number; // 1-12
  year: number;
  internId?: string;
}

export type CalendarDayStatus =
  | "REPORTED"
  | "MISSING"
  | "FUTURE"
  | "WEEKEND"
  | "OUT_OF_RANGE";

export interface CalendarDayDto {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ...
  status: CalendarDayStatus;
  reportId?: string;
  hoursWorked?: number;
  hasFeedback?: boolean;
}

export interface DailyReportCalendarResponseDto {
  internId: string;
  month: number;
  year: number;
  totalWorkingDays: number;
  reportedDays: number;
  missingDays: number;
  submissionRate: number; // Percentage 0 - 100
  days: CalendarDayDto[];
}

export interface UploadReportAttachmentUrlInput {
  fileName: string;
  mimeType: string;
}

export interface UploadReportAttachmentUrlResponseDto {
  uploadUrl: string;
  fileUrl: string;
  filePath: string;
}
