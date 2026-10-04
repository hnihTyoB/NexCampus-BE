import { AssignmentStatus, ExtensionRequestStatus } from "@prisma/client";

export interface TaskAssignmentDto {
  id: string;
  taskId: string;
  assigneeId?: string | null;
  internId?: string | null; // backwards compatibility alias for assigneeId
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
  assignee?: {
    id: string;
    email: string | null;
    fullName: string | null;
    phoneNumber?: string | null;
    avatarUrl?: string | null;
    isActive: boolean;
    internshipProfile?: {
      id: string;
      internCode: string | null;
      departmentId: string | null;
      department?: { id: string; name: string } | null;
      position?: { id: string; name: string } | null;
      mentorId?: string | null;
      status: string;
      startDate: Date | string;
      duration: number;
    } | null;
  } | null;
  intern?: {
    id: string;
    userId: string;
    leaderId?: string | null;
    fullName: string;
    phone?: string;
    status: string;
    department?: { id: string; name: string } | null;
    position?: { id: string; name: string } | null;
    user: { id: string; email: string | null; fullName: string | null };
  } | null;
  support?: {
    id: string;
    userId?: string;
    email?: string | null;
    fullName: string | null;
    phoneNumber?: string | null;
    avatarUrl?: string | null;
    isActive?: boolean;
    user?: { id: string; email: string | null; fullName: string | null };
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
  assigneeId?: string;
  internId?: string; // backwards compatibility alias for assigneeId
  internEmail?: string;
  supportId?: string | null;
}

export type AssignTaskDto = Omit<CreateTaskAssignmentDto, "taskId">;

export interface UpdateTaskAssignmentDto {
  status?: AssignmentStatus;
  blockedReason?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  assigneeId?: string;
  internId?: string; // backwards compatibility alias
  internEmail?: string;
  supportId?: string | null;
}

export interface BlockTaskDto {
  blockedReason: string;
}

export interface TaskAssignmentQueryDto {
  taskId?: string;
  assigneeId?: string;
  internId?: string; // backwards compatibility alias
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
  userId?: string;
  internId?: string;
}

export interface RejectTaskExtensionDto {
  rejectionReason: string;
}

export interface TaskExtensionRequestDto {
  id: string;
  assignmentId: string;
  userId?: string;
  internId?: string;
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
  user?: {
    id: string;
    fullName: string | null;
    email: string | null;
    internshipProfile?: {
      id: string;
      internCode: string | null;
      department?: { id: string; name: string } | null;
    } | null;
  };
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
  userId?: string;
  internId?: string;
  assignmentId?: string;
  taskId?: string;
  page?: number;
  limit?: number;
}
