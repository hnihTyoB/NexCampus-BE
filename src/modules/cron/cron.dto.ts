import { CronJobName } from '../../common/constants/cron.constant';

export interface CronJobItemDto {
  name: CronJobName;
  cron: string;
  description: string;
  nextRun?: string;
  lastRun?: string;
  lastStatus?: string;
}

export interface TriggerCronJobDto {
  params?: Record<string, unknown>;
}

export interface CronJobExecutionResultDto {
  jobName: CronJobName;
  success: boolean;
  durationMs: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ActivitySummaryStatsDto {
  newUsersCount: number;
  activeSessionsCount: number;
  notificationsSentCount: number;
  emailsSentCount: number;
  webhookDeliveriesCount: number;
  auditLogsCount: number;
}
