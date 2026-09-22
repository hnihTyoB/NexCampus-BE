export interface SystemSettingItemDto {
  key: string;
  value: string | number | boolean;
  description?: string;
  category?: string;
}

export interface UpdateSystemSettingDto {
  key?: string;
  value: string | number | boolean;
  description?: string;
  category?: string;
}

export interface BatchUpdateSystemSettingsDto {
  settings: Record<string, string | number | boolean>;
}

export interface SystemSettingsResponseDto {
  DAILY_REPORT_DEADLINE_TIME: string;
  NEXT_DAILY_REPORT_DEADLINE_TIME?: string;
  DAILY_REPORT_DEADLINE_EFFECTIVE_DATE?: string;
  DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY?: boolean;
  WORKING_DAYS_PER_WEEK: number;
  MAX_ACTIVE_TASKS: number;
  MAX_WORKLOAD_DAYS: number;
  MAX_LEADER_DEPARTMENTS: number;
  SUBMISSION_MAX_FILE_SIZE_MB: number;
  REPORT_MAX_FILE_SIZE_MB: number;
  REPORT_VIDEO_MAX_FILE_SIZE_MB: number;
  TASK_ATTACHMENT_MAX_FILE_SIZE_MB: number;
  APPLICATION_MAX_FILE_SIZE_MB: number;
  ALLOW_CROSS_DEPARTMENT_ASSIGNMENT: boolean;
  AUTO_EVALUATION_ENABLED: boolean;
  [key: string]: string | number | boolean | undefined;
}
