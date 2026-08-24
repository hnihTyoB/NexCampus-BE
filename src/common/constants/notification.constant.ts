export const NOTIFICATION_TYPE = {
  SYSTEM: 'SYSTEM',
  ALERT: 'ALERT',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE;

export const NOTIFICATION_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
} as const;

export type NotificationPriority = keyof typeof NOTIFICATION_PRIORITY;

export const NOTIFICATION_CHANNEL = {
  WEB: 'WEB',
  EMAIL: 'EMAIL',
} as const;

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNEL;

export const NOTIFICATION_TEMPLATE_CODE = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
  NEW_DEVICE_ALERT: 'NEW_DEVICE_ALERT',
  WELCOME: 'WELCOME',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ACTIVITY_SUMMARY_DIGEST: 'ACTIVITY_SUMMARY_DIGEST',
  CUSTOM: 'CUSTOM',
} as const;

export type NotificationTemplateCode = keyof typeof NOTIFICATION_TEMPLATE_CODE;

export const EMAIL_TEMPLATE_KEY = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
  NEW_DEVICE_ALERT: 'NEW_DEVICE_ALERT',
  ACTIVITY_SUMMARY_DIGEST: 'ACTIVITY_SUMMARY_DIGEST',
  CUSTOM: 'CUSTOM',
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_KEY;

export const EMAIL_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export type EmailStatus = keyof typeof EMAIL_STATUS;

export const EMAIL_MAX_ATTEMPTS = 3;

export const DEFAULT_EMAIL_SUBJECTS: Record<string, string> = {
  VERIFY_EMAIL: 'Xác thực tài khoản của bạn',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  NEW_DEVICE_ALERT: 'Phát hiện đăng nhập từ thiết bị mới',
  ACTIVITY_SUMMARY_DIGEST: 'Báo cáo tổng kết hoạt động hệ thống',
  CUSTOM: 'Thông báo từ hệ thống',
};

