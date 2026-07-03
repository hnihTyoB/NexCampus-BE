import { TaskPriority } from '@prisma/client';

export interface TaskQueryDto {
  title?: string;
  priority?: TaskPriority;
  createdBy?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  sortBy?: 'createdAt' | 'title' | 'deadline' | 'priority';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  deadline: string;
  priority?: TaskPriority;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  deadline?: string;
  priority?: TaskPriority;
}
