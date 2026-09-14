import { TaskGroupStatus } from "@prisma/client";

export interface TaskGroupDto {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  status: TaskGroupStatus;
  department?: { id: string; name: string } | null;
  maxWorkloadDays: number;
  maxActiveTasks: number | null;
  requireAllMembers: boolean;
  members?: {
    internId: string;
    intern: {
      id: string;
      leaderId: string | null;
      fullName: string;
      status: string;
      user: { email: string | null };
      department: { id: string; name: string } | null;
      position: { id: string; name: string } | null;
    };
  }[];
  _count?: { tasks: number; members: number };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTaskGroupDto {
  name: string;
  description?: string;
  departmentId?: string | null;
  status?: TaskGroupStatus;
  memberIds?: string[];
  maxWorkloadDays?: number;
  maxActiveTasks?: number | null;
  requireAllMembers?: boolean;
}

export interface UpdateTaskGroupDto {
  name?: string;
  description?: string | null;
  departmentId?: string | null;
  status?: TaskGroupStatus;
  memberIds?: string[];
  maxWorkloadDays?: number;
  maxActiveTasks?: number | null;
  requireAllMembers?: boolean;
}

export interface TaskGroupQueryDto {
  departmentId?: string;
  status?: TaskGroupStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TaskGroupProgressDto {
  taskGroupId: string;
  taskGroupName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  blockedTasks: number;
  unassignedTasks: number;
  completionRate: number;
}
