export const SYSTEM_CONFIG_CATEGORY = {
  GENERAL: 'GENERAL',
  FEATURE_FLAG: 'FEATURE_FLAG',
  INTEGRATION: 'INTEGRATION',
  SECURITY: 'SECURITY',
} as const;

export type SystemConfigCategory = keyof typeof SYSTEM_CONFIG_CATEGORY;

export const FEATURE_FLAGS = {
  REGISTRATION_ENABLED: 'feature.registration.enabled',
  NOTIFICATIONS_ENABLED: 'feature.notifications.enabled',
  WEBHOOKS_ENABLED: 'feature.webhooks.enabled',
  AI_ENABLED: 'feature.ai.enabled',
  SOCIAL_LOGIN_ENABLED: 'feature.social_login.enabled',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: 'app.name',
    value: 'Backend Template Platform',
    description: 'Tên ứng dụng hiển thị công khai',
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: 'app.support_email',
    value: 'support@example.com',
    description: 'Email liên hệ hỗ trợ khách hàng',
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: 'app.timezone',
    value: 'Asia/Ho_Chi_Minh',
    description: 'Múi giờ chuẩn mặc định của hệ thống (UTC+7 / Asia/Ho_Chi_Minh)',
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: 'app.locale',
    value: 'vi-VN',
    description: 'Ngôn ngữ và định dạng vùng mặc định (Tiếng Việt)',
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },

  {
    key: FEATURE_FLAGS.REGISTRATION_ENABLED,
    value: true,
    description: 'Cho phép người dùng mới đăng ký tài khoản tự do',
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.NOTIFICATIONS_ENABLED,
    value: true,
    description: 'Bật hệ thống gửi thông báo và email tự động',
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.WEBHOOKS_ENABLED,
    value: true,
    description: 'Bật hạ tầng Webhook dispatching và retry worker',
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.AI_ENABLED,
    value: false,
    description: 'Bật các tính năng và API hỗ trợ AI',
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.SOCIAL_LOGIN_ENABLED,
    value: true,
    description: 'Bật tính năng đăng nhập mạng xã hội (Google, Zalo)',
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
] as const;

export const SYSTEM_CONFIG_PUBSUB_CHANNEL = 'system_config:events';
