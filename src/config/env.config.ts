const MIN_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_MB = 500;

function parseFileSizeMb(raw: string | undefined): number {
  const value = parseInt(raw ?? '50', 10);

  if (isNaN(value)) {
    throw new Error(
      `[env] SUPABASE_STORAGE_MAX_FILE_SIZE_MB must be a number, got "${raw}".`,
    );
  }
  if (value < MIN_FILE_SIZE_MB || value > MAX_FILE_SIZE_MB) {
    throw new Error(
      `[env] SUPABASE_STORAGE_MAX_FILE_SIZE_MB must be between ${MIN_FILE_SIZE_MB} and ${MAX_FILE_SIZE_MB} MB, got ${value}.`,
    );
  }

  return value;
}

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

function parseRetentionDays(raw: string | undefined): number {
  const value = parseInt(raw ?? '30', 10);

  if (isNaN(value)) {
    throw new Error(
      `[env] STORAGE_CLEANUP_RETENTION_DAYS must be a number, got "${raw}".`,
    );
  }
  if (value < MIN_RETENTION_DAYS || value > MAX_RETENTION_DAYS) {
    throw new Error(
      `[env] STORAGE_CLEANUP_RETENTION_DAYS must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days, got ${value}.`,
    );
  }

  return value;
}

export const envConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8888', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'datacrawler',
  },
  get databaseUrl() {
    return `postgresql://${this.database.user}:${encodeURIComponent(this.database.password)}@${this.database.host}:${this.database.port}/${this.database.name}?schema=public`;
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'NexCampus <no-reply@nexcampus.local>',
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_TASK_BUCKET || 'task-attachments',
    storageSubmissionBucket: process.env.SUPABASE_STORAGE_SUBMISSION_BUCKET || 'submission-attachments',
    storageReportBucket: process.env.SUPABASE_STORAGE_REPORT_BUCKET || 'report-attachments',
    storageAvatarBucket: process.env.SUPABASE_STORAGE_AVATAR_BUCKET || 'avatars',
    maxFileSizeMb: parseFileSizeMb(process.env.SUPABASE_STORAGE_MAX_FILE_SIZE_MB),
  },
  storageCleanup: {
    retentionDays: parseRetentionDays(process.env.STORAGE_CLEANUP_RETENTION_DAYS),
    cronExpression: process.env.STORAGE_CLEANUP_CRON || '0 2 * * *',
  },
  gemini: {
    apiKeys: (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
  },
  aiProvider: process.env.AI_PROVIDER || 'gemini',
};
