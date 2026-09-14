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

export interface DepartmentDto {
  id: string;
  name: string;
  positions: PositionDto[];
  positionsCount?: number;
  internsCount?: number;
  _count?: {
    positions: number;
    interns: number;
  };
  leaders?: DepartmentLeaderDto[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateDepartmentDto {
  name: string;
  positions?: string[];
}

export interface UpdateDepartmentDto {
  name?: string;
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
