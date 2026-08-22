// Loại thông báo — project có thể mở rộng thêm
export const NOTIFICATION_TYPE = {
  SYSTEM: 'SYSTEM',
  ALERT: 'ALERT',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE;

// Mức độ ưu tiên
export const NOTIFICATION_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
} as const;

export type NotificationPriority = keyof typeof NOTIFICATION_PRIORITY;

// Kênh gửi thông báo
export const NOTIFICATION_CHANNEL = {
  WEB: 'WEB',
  EMAIL: 'EMAIL',
} as const;

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNEL;

// Template key cho email — project thêm key tuỳ nghiệp vụ
export const EMAIL_TEMPLATE_KEY = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
  NEW_DEVICE_ALERT: 'NEW_DEVICE_ALERT',
  CUSTOM: 'CUSTOM',
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_KEY;

// Trạng thái gửi email
export const EMAIL_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export type EmailStatus = keyof typeof EMAIL_STATUS;

// Số lần retry tối đa cho email thất bại
export const EMAIL_MAX_ATTEMPTS = 3;
