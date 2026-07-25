export interface TaskGroupDto {
  id: string;
  name: string;
  description: string | null;
  _count?: { tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskGroupDto {
  name: string;
  description?: string;
}

export interface UpdateTaskGroupDto {
  name?: string;
  description?: string | null;
}
