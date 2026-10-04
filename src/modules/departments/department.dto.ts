export interface PositionDto {
  id: string;
  departmentId: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DepartmentLeaderDto {
  id: string;
  user: {
    id?: string;
    fullName: string | null;
    email: string | null;
    avatarUrl?: string | null;
  };
}

export interface DepartmentManagerDto {
  departmentId: string;
  userId: string;
  title?: string | null;
  isPrimary: boolean;
  createdAt?: Date;
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    avatarUrl?: string | null;
  };
}

export interface AssignDepartmentManagerDto {
  userId: string;
  title?: string | null;
  isPrimary?: boolean;
}

export interface UpdateDepartmentManagerDto {
  title?: string | null;
  isPrimary?: boolean;
}

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string | null;
  positions: PositionDto[];
  positionsCount?: number;
  internsCount?: number;
  _count?: {
    positions: number;
    internshipProfiles?: number;
    interns?: number;
    managers?: number;
  };
  managers?: DepartmentManagerDto[];
  leaders?: DepartmentLeaderDto[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateDepartmentDto {
  name: string;
  description?: string | null;
  positions?: string[];
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string | null;
}

export interface DepartmentQueryDto {
  name?: string;
  leader?: string;
}

export interface CreatePositionDto {
  departmentId: string;
  name: string;
}

export interface UpdatePositionDto {
  departmentId?: string;
  name?: string;
}

