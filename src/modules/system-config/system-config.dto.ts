import { SystemConfigCategory } from '../../common/constants/system-config.constant';

export interface SystemConfigItemDto {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  category: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemConfigDto {
  key: string;
  value: unknown;
  description?: string;
  category?: SystemConfigCategory | string;
  isPublic?: boolean;
}

export interface UpdateSystemConfigDto {
  value?: unknown;
  description?: string;
  category?: SystemConfigCategory | string;
  isPublic?: boolean;
}

export interface ToggleFeatureFlagDto {
  enabled: boolean;
  description?: string;
}

export interface SystemConfigQueryDto {
  category?: string;
  isPublic?: boolean;
  search?: string;
}

export interface PublicConfigsResponseDto {
  [key: string]: unknown;
}
