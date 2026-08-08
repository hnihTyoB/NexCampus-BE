import { AssignmentStatus } from "@prisma/client";

export interface TaskAssignmentQueryDto {
  taskId?: string;
  internId?: string;
  assignedBy?: string;
  status?: AssignmentStatus;
  leaderId?: string;
  sortBy?: "assignedAt" | "status";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateTaskAssignmentDto {
  taskId: string;
  internId: string;
  internEmail?: string;
}

export type AssignTaskDto = Omit<CreateTaskAssignmentDto, "taskId">;

export interface UpdateTaskAssignmentDto {
  status?: AssignmentStatus;
  blockedReason?: string;
  internId?: string;
  internEmail?: string;
}
