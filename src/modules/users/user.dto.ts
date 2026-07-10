export interface UserQueryDto {
  email?: string;
  fullName?: string;
  roleName?: string;
  isActive?: boolean;
  sortBy?: "createdAt" | "email" | "fullName";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateUserDto {
  email: string;
  password?: string;
  role: "LEADER" | "INTERN";
}

export interface UpdateUserDto {
  isActive?: boolean;
  roleId?: "LEADER" | "INTERN";
}

export interface UserResponseDto {
  id: string;
  email: string;
  roleId: string;
  role?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
