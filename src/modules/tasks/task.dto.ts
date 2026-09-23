import { AssignmentStatus, TaskPriority } from "@prisma/client";

export interface TaskDto {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  deadline: Date | string;
  startDate: Date | string | null;
  estDays: number | null;
  phase: string | null;
  module: string | null;
  acceptanceCriteria: string | null;
  taskNotes: string | null;
  priority: TaskPriority;
  taskGroupId: string | null;
  createdBy: string;
  taskGroup?: { id: string; name: string; departmentId: string | null } | null;
  creator?: { id: string; email: string | null; fullName: string | null };
  assignment?: {
    id: string;
    taskId: string;
    internId: string | null;
    supportId: string | null;
    assignedBy: string;
    status: AssignmentStatus;
    blockedReason: string | null;
    assignedAt: Date | string;
    updatedAt: Date | string;
    intern?: { id: string; fullName: string } | null;
    support?: { id: string; fullName: string } | null;
  } | null;
  attachments?: TaskAttachmentDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  deadline: string;
  estDays: number;
  priority?: TaskPriority;
  code?: string;
  startDate?: string;
  phase?: string;
  module?: string;
  acceptanceCriteria?: string;
  taskNotes?: string;
  taskGroupId?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  deadline?: string;
  priority?: TaskPriority;
  code?: string | null;
  startDate?: string | null;
  estDays?: number | null;
  phase?: string | null;
  module?: string | null;
  acceptanceCriteria?: string | null;
  taskNotes?: string | null;
  taskGroupId?: string | null;
  recreatedTaskId?: string | null;
}

export interface TaskQueryDto {
  title?: string;
  code?: string;
  owner?: string;
  priority?: TaskPriority;
  createdBy?: string;
  phase?: string;
  module?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  taskGroupId?: string;
  status?: AssignmentStatus;
  statusNot?: AssignmentStatus;
  sortBy?: "createdAt" | "title" | "deadline" | "priority";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface TaskAttachmentDto {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date | string;
}

export interface CreateLinkAttachmentDto {
  fileName: string;
  fileUrl: string;
}

export interface ConfirmAttachmentUploadDto {
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface CandidateAllocationDto {
  id: string;
  fullName: string;
  suggestedRole?: "OWNER" | "SUPPORT";
  position?: { name: string };
  activeTaskDays: number;
  latestCodingScore?: number;
  latestLearningScore?: number;
  completedModules?: string[];
  compatibilityScore?: number;
  workloadScore?: number;
  skillScore?: number;
  performanceScore?: number;
  learningScore?: number;
}

export interface TaskAllocationInputDto {
  task: {
    title: string;
    description?: string | null;
    module?: string | null;
    priority?: string;
    estDays: number;
    maxWorkloadDays?: number;
    deadline?: string;
  };
  candidates: CandidateAllocationDto[];
}

export interface TaskAllocationResultDto {
  recommendedOwnerId: string;
  recommendedSupportId: string | null;
  riskLevel: RiskLevel;
  workloadAnalysis: string;
  learningOpportunity: string;
  reasons: string[];
  candidateRankings?: Array<{
    candidateId: string;
    fullName: string;
    estimatedWorkload: number;
    riskLevel: RiskLevel;
    compatibilityScore: number;
  }>;
}

// ─── Analytics DTOs ───────────────────────────────────────────────────────────

export interface TaskStatusDistributionDto {
  status: string;
  count: number;
}

export interface TaskPriorityDistributionDto {
  priority: string;
  count: number;
}

export interface WorkloadByInternDto {
  internId: string;
  internFullName: string;
  totalTasks: number;
  totalEstDays: number;
  byStatus: TaskStatusDistributionDto[];
}

export interface PhaseProgressDto {
  phase: string;
  totalTasks: number;
  doneTasks: number;
  completionRate: number; // 0.0 – 1.0
}

export interface TaskAnalyticsDto {
  overview: {
    totalTasks: number;
    overdueTasks: number;
    byStatus: TaskStatusDistributionDto[];
    byPriority: TaskPriorityDistributionDto[];
  };
  workloadByIntern: WorkloadByInternDto[];
  progressByPhase: PhaseProgressDto[];
}

export interface TaskAnalyticsQueryDto {
  taskGroupId?: string;
  dateFrom?: string;
  dateTo?: string;
}

