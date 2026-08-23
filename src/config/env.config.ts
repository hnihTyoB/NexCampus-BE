export const envConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8888', 10),
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    accessSecret: (() => {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (process.env.NODE_ENV === 'production' && (!secret || secret === 'default_access_secret')) {
        throw new Error('JWT_ACCESS_SECRET must be securely set in production');
      }
      return secret || 'default_access_secret';
    })(),
    refreshSecret: (() => {
      const secret = process.env.JWT_REFRESH_SECRET;
      if (process.env.NODE_ENV === 'production' && (!secret || secret === 'default_refresh_secret')) {
        throw new Error('JWT_REFRESH_SECRET must be securely set in production');
      }
      return secret || 'default_refresh_secret';
    })(),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  trustProxy: (() => {
    const val = process.env.TRUST_PROXY;
    if (!val) return false;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    if (val.includes(',')) return val.split(',').map(s => s.trim());
    return val;
  })(),
  cors: {
    allowedOrigins: (() => {
      const origins = process.env.ALLOWED_ORIGINS;
      if (process.env.NODE_ENV === 'production' && (!origins || origins === '*' || origins.split(',').map(s => s.trim()).includes('*'))) {
        throw new Error('ALLOWED_ORIGINS must be explicitly set with trusted domain names in production (wildcards are not allowed)');
      }
      return origins ? origins.split(',').map(s => s.trim()) : ['*'];
    })(),
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
    presignedUrlExpiresIn: parseInt(process.env.R2_PRESIGNED_URL_EXPIRES_IN_SECONDS || '300', 10),
    avatarMaxFileSizeMb: parseFloat(process.env.R2_AVATAR_MAX_FILE_SIZE_MB || '5'),
  },
  notification: {
    workerEnabled: process.env.NOTIFICATION_WORKER_ENABLED !== 'false',
    workerIntervalMs: parseInt(process.env.NOTIFICATION_WORKER_INTERVAL_MS || '60000', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '30', 10),
  },
  encryption: {
    key: (() => {
      const key = process.env.ENCRYPTION_KEY || process.env.APP_SECRET || process.env.JWT_ACCESS_SECRET;
      if (process.env.NODE_ENV === 'production' && (!key || key === 'default_access_secret')) {
        throw new Error('ENCRYPTION_KEY or APP_SECRET must be securely set in production');
      }
      return key || 'default_32_bytes_secret_key_aes256_gcm!!';
    })(),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6381', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.REDIS_ENABLED !== 'false',
  },
  webhook: {
    maxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10),
    timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
  },
};
