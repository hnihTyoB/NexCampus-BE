import { AssignmentStatus } from '@prisma/client';

export interface TaskAssignmentQueryDto {
  taskId?: string;
  internId?: string;
  assignedBy?: string;
  status?: AssignmentStatus;
  sortBy?: 'assignedAt' | 'status';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateTaskAssignmentDto {
  taskId: string;
  internId: string;
}

export interface UpdateTaskAssignmentDto {
  status?: AssignmentStatus;
  internId?: string;
}
