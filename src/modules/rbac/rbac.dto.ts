export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
}

export interface AssignPermissionsDto {
  permissionIds: string[];
}

export interface AssignUserRoleDto {
  roleId: string;
}

export interface RoleQueryDto {
  search?: string;
  sortBy?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AuditLogQueryDto {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  page?: number;
  limit?: number;
}
