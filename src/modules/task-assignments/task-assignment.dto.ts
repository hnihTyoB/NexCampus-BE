import { AssignmentStatus, ExtensionRequestStatus } from "@prisma/client";

export interface TaskAssignmentDto {
  id: string;
  taskId: string;
  internId: string | null;
  supportId: string | null;
  assignedBy: string;
  status: AssignmentStatus;
  blockedReason: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
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
  extensionRequests?: TaskExtensionRequestDto[];
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
  blockedReason?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  internId?: string;
  internEmail?: string;
  supportId?: string | null;
}

export interface BlockTaskDto {
  blockedReason: string;
}

export interface TaskAssignmentQueryDto {
  taskId?: string;
  internId?: string;
  assignedBy?: string;
  status?: AssignmentStatus;
  leaderId?: string;
  role?: "ALL" | "OWNER" | "SUPPORT";
  sortBy?: "assignedAt" | "status";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface RejectAssignmentDto {
  reason?: string;
}

export interface RequestTaskExtensionDto {
  proposedDeadline: string;
  extensionDays: number;
  reason: string;
  commitmentPlan: string;
}

export interface RejectTaskExtensionDto {
  rejectionReason: string;
}

export interface TaskExtensionRequestDto {
  id: string;
  assignmentId: string;
  internId: string;
  currentDeadline: Date | string;
  proposedDeadline: Date | string;
  extensionDays: number;
  reason: string;
  commitmentPlan: string;
  status: ExtensionRequestStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  intern?: {
    id: string;
    fullName: string;
    internCode: string | null;
    user: { id: string; email: string | null };
    department?: { id: string; name: string } | null;
  };
  reviewer?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  assignment?: {
    id: string;
    taskId: string;
    status: AssignmentStatus;
    task?: {
      id: string;
      code: string | null;
      title: string;
      deadline: Date | string;
    };
  };
  totalExtensionsOnTask?: number;
  totalExtensionsInInternship?: number;
}

export interface QueryExtensionRequestsDto {
  status?: ExtensionRequestStatus;
  internId?: string;
  assignmentId?: string;
  taskId?: string;
  page?: number;
  limit?: number;
}

