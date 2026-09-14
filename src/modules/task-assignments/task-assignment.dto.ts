import { AssignmentStatus } from "@prisma/client";

export interface TaskAssignmentDto {
  id: string;
  taskId: string;
  internId: string | null;
  supportId: string | null;
  assignedBy: string;
  status: AssignmentStatus;
  blockedReason: string | null;
  assignedAt: Date | string;
  updatedAt: Date | string;
  task?: {
    id: string;
    code: string | null;
    title: string;
    description: string | null;
    deadline: Date | string;
    estDays: number | null;
    priority: string;
    taskGroupId: string | null;
    taskGroup?: { id: string; name: string; departmentId: string | null } | null;
  };
  intern?: {
    id: string;
    userId: string;
    leaderId: string | null;
    fullName: string;
    phone: string;
    status: string;
    department?: { id: string; name: string } | null;
    position?: { id: string; name: string } | null;
    user: { id: string; email: string | null; fullName: string | null };
  } | null;
  support?: {
    id: string;
    userId: string;
    leaderId: string | null;
    fullName: string;
    status: string;
    user: { id: string; email: string | null; fullName: string | null };
  } | null;
  assigner?: {
    id: string;
    email: string | null;
    fullName: string | null;
  };
}

export interface CreateTaskAssignmentDto {
  taskId: string;
  internId: string;
  internEmail?: string;
  supportId?: string | null;
}

export type AssignTaskDto = Omit<CreateTaskAssignmentDto, "taskId">;

export interface UpdateTaskAssignmentDto {
  status?: AssignmentStatus;
  blockedReason?: string;
  internId?: string;
  internEmail?: string;
  supportId?: string | null;
}

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

export interface RejectAssignmentDto {
  reason?: string;
}
