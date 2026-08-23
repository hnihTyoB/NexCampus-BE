export const MAINTENANCE_STATUS = {
  ONLINE: 'ONLINE',
  MAINTENANCE: 'MAINTENANCE',
  READ_ONLY: 'READ_ONLY',
} as const;

export type MaintenanceStatus = keyof typeof MAINTENANCE_STATUS;

export const DEFAULT_MAINTENANCE_CONFIG = {
  key: 'DEFAULT',
  enabled: false,
  status: MAINTENANCE_STATUS.ONLINE,
  title: 'Hệ thống đang bảo trì',
  message: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.',
  bypassPermissions: ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'],
  bypassRoles: ['ADMIN'],
  bypassIps: [] as string[],
} as const;

export const MAINTENANCE_PUBSUB_CHANNEL = 'maintenance:events';
