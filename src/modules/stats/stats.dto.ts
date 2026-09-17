export interface AdminSystemStatsDto {
  activeInterns: number;
  totalInterns: number;
  completedInterns: number;
  droppedInterns: number;
  retentionRate: number;
  activeLeaders: number;
  activeDepartments: number;
}

export interface AdminTaskStatsDto {
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalTasks: number;
  systemCompletionRate: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface AdminSubmissionStatsDto {
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  totalSubmissions: number;
}

export interface AdminApplicationStatsDto {
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalApplications: number;
}

export interface DepartmentDistributionDto {
  departmentId: string;
  departmentName: string;
  internCount: number;
  leaderCount: number;
}

export interface LeaderTeamProgressDto {
  leaderId: string;
  leaderName: string;
  leaderEmail?: string;
  departmentName: string;
  internCount: number;
  totalInterns?: number;
  activeTasksCount: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  overdueCount?: number;
  totalAssignments?: number;
  assignments?: {
    pendingApproval: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    blocked: number;
  };
  riskLevel: "HEALTHY" | "WARNING" | "DANGER";
}

export interface ActionAlertsDto {
  pendingApplicationsCount: number;
  overdueTasksCount: number;
  droppedInternsCount: number;
}

export interface RecentActivityDto {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface InternStatsDto {
  total: number;
  active: number;
  completed: number;
  dropped: number;
}

export interface AdminStatsResponseDto {
  system: AdminSystemStatsDto & {
    leaders?: number;
    departments?: number;
    users?: number;
  };
  interns?: InternStatsDto;
  tasks: AdminTaskStatsDto & { overdue?: number };
  submissions: AdminSubmissionStatsDto & {
    pending?: number;
    approved?: number;
    rejected?: number;
    total?: number;
  };
  applications: AdminApplicationStatsDto & {
    pending?: number;
    approved?: number;
    rejected?: number;
    total?: number;
  };
  assignments?: {
    total: number;
    byStatus: Record<string, number>;
  };
  dailyReports?: {
    last30Days: number;
    avgPerDay: number;
  };
  weeklyEvaluations?: {
    total: number;
    avgScore: number;
  };
  notifications?: {
    total: number;
    unread: number;
  };
  retentionRate?: number;
  systemCompletionRate?: number;
  departmentDistribution: DepartmentDistributionDto[];
  leaderTeams: LeaderTeamProgressDto[];
  actionAlerts: ActionAlertsDto;
  recentActivities: RecentActivityDto[];
  overdueAssignments?: any[];
}

export interface LeaderInternStatsDto {
  totalInterns: number;
  activeInterns: number;
}

export interface LeaderWorkloadDto {
  activeWorkloadDays: number;
  activeTasksCount: number;
  totalAssignmentsCount: number;
}

export interface LeaderSubmissionStatsDto {
  pendingSubmissionsCount: number;
  approvedSubmissionsCount: number;
  rejectedSubmissionsCount: number;
}

export interface DailyReportRateDto {
  todaySubmitted: number;
  totalActiveInterns: number;
  todayRate: number;
  weeklySubmitted: number;
  expectedWeeklyReports: number;
  weeklyRate: number;
}

export interface LeaderTasksByStatusDto {
  pendingApproval: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
  overdueTasksCount: number;
}

export interface LeaderEvaluationStatsDto {
  totalEvaluations: number;
  avgScore: number;
}

export interface LeaderInternProgressDto {
  internId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  avgScore: number;
  overdueTasks: number;
  healthStatus: "HEALTHY" | "WARNING" | "DANGER";
}

export interface LeaderStatsResponseDto {
  interns: LeaderInternStatsDto;
  workload: LeaderWorkloadDto;
  submissions: LeaderSubmissionStatsDto;
  dailyReportRate: DailyReportRateDto;
  tasksByStatus: LeaderTasksByStatusDto;
  evaluations: LeaderEvaluationStatsDto;
  internProgress: LeaderInternProgressDto[];
}

export interface InternTaskStatsDto {
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completionRate: number;
}

export interface InternReportStatsDto {
  dailyReportTodaySubmitted: boolean;
  reportStreak: number;
  weeklyReportsSubmitted: number;
  workingDaysCount: number;
}

export interface InternEvaluationStatsDto {
  lastWeekScore: number | null;
  avgScore: number;
  totalEvaluations: number;
}

export interface ReworkSubmissionDto {
  submissionId: string;
  taskId: string;
  taskTitle: string;
  attempt: number;
  reviewComment: string | null;
  submittedAt: string;
}

export interface RecentTaskItemDto {
  id: string;
  code: string | null;
  title: string;
  priority: string;
  status: string;
  deadline: string | null;
  isOverdue: boolean;
}

export interface InternStatsResponseDto {
  internId?: string;
  internName: string;
  internCode: string | null;
  departmentName: string;
  tasks: InternTaskStatsDto;
  reports: InternReportStatsDto;
  evaluations: InternEvaluationStatsDto;
  needsRework: ReworkSubmissionDto[];
  recentTasks: RecentTaskItemDto[];
}
