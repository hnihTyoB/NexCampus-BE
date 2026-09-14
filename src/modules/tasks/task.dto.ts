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
