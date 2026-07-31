export interface DepartmentDto {
  id: string;
  name: string;
  positions: PositionDto[];
  leaders?: {
    id: string;
    user: {
      fullName: string | null;
      email: string;
    };
  }[];
}

export interface PositionDto {
  id: string;
  departmentId: string;
  name: string;
}

export interface CreateDepartmentDto {
  name: string;
  positions?: string[];
}

export interface UpdateDepartmentDto {
  name?: string;
}

export interface CreatePositionDto {
  departmentId: string;
  name: string;
}

export interface UpdatePositionDto {
  departmentId?: string;
  name?: string;
}
