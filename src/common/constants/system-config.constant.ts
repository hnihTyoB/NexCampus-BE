export const SYSTEM_CONFIG_CATEGORY = {
  GENERAL: "GENERAL",
  FEATURE_FLAG: "FEATURE_FLAG",
  INTEGRATION: "INTEGRATION",
  SECURITY: "SECURITY",
} as const;

export type SystemConfigCategory = keyof typeof SYSTEM_CONFIG_CATEGORY;

export const FEATURE_FLAGS = {
  REGISTRATION_ENABLED: "feature.registration.enabled",
  NOTIFICATIONS_ENABLED: "feature.notifications.enabled",
  WEBHOOKS_ENABLED: "feature.webhooks.enabled",
  AI_ENABLED: "feature.ai.enabled",
  SOCIAL_LOGIN_ENABLED: "feature.social_login.enabled",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const HRM_CONFIG_KEYS = {
  MAX_LEADER_DEPARTMENTS: "hrm.max_leader_departments",
  DEFAULT_INTERN_DURATION_MONTHS: "hrm.default_intern_duration_months",
  INTERN_CODE_PREFIX: "hrm.intern_code_prefix",
  MAX_ACTIVE_TASKS_PER_INTERN: "hrm.max_active_tasks_per_intern",
  AUTO_COMPLETE_EXPIRED_INTERNS: "hrm.auto_complete_expired_interns",
} as const;

export type HrmConfigKey =
  (typeof HRM_CONFIG_KEYS)[keyof typeof HRM_CONFIG_KEYS];

export const STORAGE_CONFIG_KEYS = {
  AVATAR_MAX_FILE_SIZE_MB: "storage.avatar_max_file_size_mb",
  REPORT_MAX_FILE_SIZE_MB: "storage.report_max_file_size_mb",
  SUBMISSION_MAX_FILE_SIZE_MB: "storage.submission_max_file_size_mb",
  TASK_ATTACHMENT_MAX_FILE_SIZE_MB: "storage.task_attachment_max_file_size_mb",
} as const;

export type StorageConfigKey =
  (typeof STORAGE_CONFIG_KEYS)[keyof typeof STORAGE_CONFIG_KEYS];

export const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: "app.name",
    value: "Backend Template Platform",
    description: "Tên ứng dụng hiển thị công khai",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.support_email",
    value: "support@example.com",
    description: "Email liên hệ hỗ trợ khách hàng",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.timezone",
    value: "Asia/Ho_Chi_Minh",
    description:
      "Múi giờ chuẩn mặc định của hệ thống (UTC+7 / Asia/Ho_Chi_Minh)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.locale",
    value: "vi-VN",
    description: "Ngôn ngữ và định dạng vùng mặc định (Tiếng Việt)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },

  {
    key: FEATURE_FLAGS.REGISTRATION_ENABLED,
    value: true,
    description: "Cho phép người dùng mới đăng ký tài khoản tự do",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.NOTIFICATIONS_ENABLED,
    value: true,
    description: "Bật hệ thống gửi thông báo và email tự động",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.WEBHOOKS_ENABLED,
    value: true,
    description: "Bật hạ tầng Webhook dispatching và retry worker",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.AI_ENABLED,
    value: false,
    description: "Bật các tính năng và API hỗ trợ AI",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.SOCIAL_LOGIN_ENABLED,
    value: true,
    description: "Bật tính năng đăng nhập mạng xã hội (Google, Zalo)",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },

  // Organization & Human Resource Management (HRM) Configs
  {
    key: HRM_CONFIG_KEYS.MAX_LEADER_DEPARTMENTS,
    value: 3,
    description:
      "Số lượng phòng ban tối đa một Leader có thể quản lý đồng thời",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS,
    value: 3,
    description: "Thời gian thực tập mặc định tính theo tháng",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: HRM_CONFIG_KEYS.INTERN_CODE_PREFIX,
    value: "INT",
    description: "Tiền tố sinh mã định danh thực tập sinh tự động",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
  },
  {
    key: HRM_CONFIG_KEYS.MAX_ACTIVE_TASKS_PER_INTERN,
    value: 5,
    description: "Số lượng công việc đang xử lý tối đa cho mỗi thực tập sinh",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: HRM_CONFIG_KEYS.AUTO_COMPLETE_EXPIRED_INTERNS,
    value: true,
    description:
      "Tự động chuyển trạng thái thực tập sinh sang COMPLETED khi hết hạn thời gian",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },

  // Storage & Upload Limit Configs
  {
    key: STORAGE_CONFIG_KEYS.AVATAR_MAX_FILE_SIZE_MB,
    value: 5,
    description: "Kích thước tệp tối đa khi tải lên ảnh đại diện (MB)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: STORAGE_CONFIG_KEYS.REPORT_MAX_FILE_SIZE_MB,
    value: 10,
    description: "Kích thước tệp tối đa khi tải lên báo cáo hàng ngày (MB)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: STORAGE_CONFIG_KEYS.SUBMISSION_MAX_FILE_SIZE_MB,
    value: 50,
    description: "Kích thước tệp tối đa khi nộp bài tập / nhiệm vụ (MB)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: STORAGE_CONFIG_KEYS.TASK_ATTACHMENT_MAX_FILE_SIZE_MB,
    value: 25,
    description: "Kích thước tệp đính kèm nhiệm vụ tối đa (MB)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
] as const;

export const SYSTEM_CONFIG_PUBSUB_CHANNEL = "system_config:events";
