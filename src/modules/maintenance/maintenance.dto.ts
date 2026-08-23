import { MaintenanceStatus } from '../../common/constants/maintenance.constant';

export interface PublicMaintenanceStatusDto {
  enabled: boolean;
  status: MaintenanceStatus;
  title: string;
  message: string;
  startAt: string | null;
  estimatedEndAt: string | null;
}

export interface EnableMaintenanceDto {
  title?: string;
  message?: string;
  startAt?: string | null;
  estimatedEndAt?: string | null;
  bypassPermissions?: string[];
  bypassRoles?: string[];
  bypassIps?: string[];
  status?: 'MAINTENANCE' | 'READ_ONLY';
}

export interface UpdateMaintenanceDto {
  enabled?: boolean;
  status?: MaintenanceStatus;
  title?: string;
  message?: string;
  startAt?: string | null;
  estimatedEndAt?: string | null;
  bypassPermissions?: string[];
  bypassRoles?: string[];
  bypassIps?: string[];
}
