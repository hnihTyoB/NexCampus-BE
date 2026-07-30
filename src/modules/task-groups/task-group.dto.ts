export interface TaskGroupDto {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  _count?: { tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskGroupDto {
  name: string;
  description?: string;
  departmentId?: string | null;
}

export interface UpdateTaskGroupDto {
  name?: string;
  description?: string | null;
  departmentId?: string | null;
}
