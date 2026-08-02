export interface TaskGroupDto {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
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
      user: { email: string };
      department: { id: string; name: string } | null;
      position: { id: string; name: string } | null;
    };
  }[];
  _count?: { tasks: number; members: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskGroupDto {
  name: string;
  description?: string;
  departmentId?: string | null;
  memberIds?: string[];
  maxWorkloadDays?: number;
  maxActiveTasks?: number | null;
  requireAllMembers?: boolean;
}

export interface UpdateTaskGroupDto {
  name?: string;
  description?: string | null;
  departmentId?: string | null;
  memberIds?: string[];
  maxWorkloadDays?: number;
  maxActiveTasks?: number | null;
  requireAllMembers?: boolean;
}
