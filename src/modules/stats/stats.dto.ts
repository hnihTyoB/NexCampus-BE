export interface InternStatsDto {
  total: number;
  active: number;
  completed: number;
  dropped: number;
}

export interface ApplicationStatsDto {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface TaskPriorityStatsDto {
  low: number;
  medium: number;
  high: number;
}

export interface TaskStatsDto {
  total: number;
  overdue: number;
  byPriority: TaskPriorityStatsDto;
}

export interface AssignmentStatusStatsDto {
  pendingApproval: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
}

export interface AssignmentStatsDto {
  total?: number;
  byStatus: AssignmentStatusStatsDto;
}

export interface SubmissionStatsDto {
  total?: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface DailyReportStatsDto {
  last30Days: number;
  avgPerDay: number;
  submittedTodayCount?: number;
}

export interface WeeklyEvaluationStatsDto {
  total: number;
  avgScore: number;
}

export interface NotificationStatsDto {
  total: number;
  unread: number;
}

export interface SystemStatsDto {
  leaders: number;
  departments: number;
  users: number;
}

export interface AssignmentDetailDto {
  id: string;
  status: string;
  taskTitle: string;
  taskPriority: string;
  taskDeadline: string | null;
  isOverdue: boolean;
  internName: string;
  internEmail: string;
  leaderName: string;
}

export interface LeaderTeamProgressDto {
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
  departmentName: string;
  totalInterns: number;
  totalAssignments: number;
  assignments: AssignmentStatusStatsDto;
  overdueCount: number;
}

export interface InternTeamProgressDto {
  internId: string;
  internName: string;
  internEmail: string;
  completedTasks: number;
  totalTasks: number;
  avgScore: number;
  overdueCount: number;
  healthStatus: "HEALTHY" | "WARNING" | "DANGER";
}

export interface InternPersonalStatsDto {
  internName: string;
  tasksInProgress: number;
  tasksCompleted: number;
  tasksOverdue: number;
  totalTasks: number;
  completionRate: number;
  dailyReportTodaySubmitted: boolean;
  lastWeekScore: number | null;
  avgScore: number;
  todaysTasks: AssignmentDetailDto[];
}

export interface ActivityLogDto {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface AdminStatsResponseDto {
  system: SystemStatsDto;
  interns: InternStatsDto;
  applications: ApplicationStatsDto;
  tasks: TaskStatsDto;
  assignments: AssignmentStatsDto;
  submissions: SubmissionStatsDto;
  dailyReports: DailyReportStatsDto;
  weeklyEvaluations: WeeklyEvaluationStatsDto;
  notifications: NotificationStatsDto;
  recentAssignments: AssignmentDetailDto[];
  overdueAssignments: AssignmentDetailDto[];
  leaderTeams: LeaderTeamProgressDto[];
  systemCompletionRate: number;
  recentActivities: ActivityLogDto[];
}

export interface LeaderStatsResponseDto {
  interns: InternStatsDto;
  assignments: AssignmentStatsDto;
  submissions: SubmissionStatsDto;
  dailyReports: DailyReportStatsDto;
  weeklyEvaluations: WeeklyEvaluationStatsDto;
  recentAssignments: AssignmentDetailDto[];
  overdueAssignments: AssignmentDetailDto[];
  internProgress: InternTeamProgressDto[];
}
