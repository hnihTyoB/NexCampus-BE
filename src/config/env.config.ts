import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    // ── Core ─────────────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(9999),

    // ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // ── JWT ──────────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().default("default_access_secret"),
    JWT_REFRESH_SECRET: z.string().default("default_refresh_secret"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // ── Trust Proxy ───────────────────────────────────────────────────────────
    TRUST_PROXY: z.string().default("false"),

    // ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: z.string().default("*"),

    // ── Encryption ───────────────────────────────────────────────────────────
    ENCRYPTION_KEY: z.string().default(""),
    APP_SECRET: z.string().default(""),

    // ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: z.string().default(""),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(6381),
    REDIS_PASSWORD: z.string().default(""),
    REDIS_ENABLED: z.string().default("true"),

    // ── Rate Limit ────────────────────────────────────────────────────────────
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900000),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),

    // ── Cloudflare R2 ────────────────────────────────────────────────────────
    R2_ACCOUNT_ID: z.string().default(""),
    R2_BUCKET_NAME: z.string().default(""),
    R2_ACCESS_KEY_ID: z.string().default(""),
    R2_SECRET_ACCESS_KEY: z.string().default(""),
    R2_PUBLIC_BASE_URL: z.string().default(""),
    R2_PRESIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(300),
    R2_AVATAR_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),

    // ── Notification Worker ───────────────────────────────────────────────────
    NOTIFICATION_WORKER_ENABLED: z.string().default("true"),
    NOTIFICATION_WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60000),

    // ── Webhook ───────────────────────────────────────────────────────────────
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

    // ── Google OAuth2 ─────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),

    // ── Application Base URL ───────────────────────────────────────────────────
    APP_URL: z.string().default("http://localhost:7777"),

    // ── Mail / SMTP ───────────────────────────────────────────────────────────
    MAIL_HOST: z.string().default("smtp.gmail.com"),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: z.string().default("false"),
    MAIL_USER: z.string().default(""),
    MAIL_PASS: z.string().default(""),
    MAIL_FROM: z.string().default("App Template <noreply@gmail.com>"),
  })
  // ── Production-only Constraints ───────────────────────────────────────────
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      return (
        env.JWT_ACCESS_SECRET.length > 0 &&
        env.JWT_ACCESS_SECRET !== "default_access_secret"
      );
    },
    {
      message:
        "JWT_ACCESS_SECRET must be securely set in production (không được dùng giá trị mặc định)",
      path: ["JWT_ACCESS_SECRET"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      return (
        env.JWT_REFRESH_SECRET.length > 0 &&
        env.JWT_REFRESH_SECRET !== "default_refresh_secret"
      );
    },
    {
      message:
        "JWT_REFRESH_SECRET must be securely set in production (không được dùng giá trị mặc định)",
      path: ["JWT_REFRESH_SECRET"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      const origins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
      return !origins.includes("*");
    },
    {
      message:
        "ALLOWED_ORIGINS must be explicitly set with trusted domains in production (wildcard * is not allowed)",
      path: ["ALLOWED_ORIGINS"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      const key = env.ENCRYPTION_KEY || env.APP_SECRET;
      return typeof key === "string" && key.length >= 32;
    },
    {
      message:
        "ENCRYPTION_KEY (or APP_SECRET) must be explicitly configured with at least 32 characters in production",
      path: ["ENCRYPTION_KEY"],
    },
  );

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const issues = _parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  process.stderr.write(
    `\n[ENV] ❌ Lỗi cấu hình biến môi trường — server không thể khởi động:\n${issues}\n\n`,
  );
  process.exit(1);
}

const _env = _parsed.data;

/** Phân giải giá trị TRUST_PROXY sang kiểu mà Express chấp nhận */
function parseTrustProxy(val: string): boolean | number | string | string[] {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (val.includes(",")) return val.split(",").map((s) => s.trim());
  return val;
}

/** Giải quyết encryption key theo thứ tự ưu tiên: ENCRYPTION_KEY > APP_SECRET. Tuyệt đối không fallback sang JWT_ACCESS_SECRET trong production */
function resolveEncryptionKey(): string {
  const key = _env.ENCRYPTION_KEY || _env.APP_SECRET;
  if (key && key.length >= 32) {
    return key;
  }
  if (_env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY or APP_SECRET must be explicitly configured with at least 32 characters in production",
    );
  }
  return key || _env.JWT_ACCESS_SECRET || "default_32_bytes_secret_key_aes256_gcm!!";
}

/** Phân giải cấu hình Redis: ưu tiên REDIS_URL (DSN) nếu có, fallback sang biến đơn */
function resolveRedisConfig() {
  let host = _env.REDIS_HOST;
  let port = _env.REDIS_PORT;
  let password: string | undefined = _env.REDIS_PASSWORD || undefined;

  if (_env.REDIS_URL) {
    try {
      const parsed = new URL(_env.REDIS_URL);
      host = parsed.hostname || host;
      port = parsed.port
        ? parseInt(parsed.port, 10)
        : parsed.protocol === "rediss:"
          ? 6380
          : 6379;
      if (parsed.password) {
        password = decodeURIComponent(parsed.password);
      }
    } catch {
      // URL không hợp lệ - fallback về biến đơn đã được parse ở trên
    }
  }

  return {
    host,
    port,
    password,
    enabled: _env.REDIS_ENABLED !== "false",
  };
}

export const envConfig = {
  nodeEnv: _env.NODE_ENV,
  port: _env.PORT,
  database: {
    url: _env.DATABASE_URL,
  },
  jwt: {
    accessSecret: _env.JWT_ACCESS_SECRET,
    refreshSecret: _env.JWT_REFRESH_SECRET,
    accessExpiresIn: _env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: _env.JWT_REFRESH_EXPIRES_IN,
  },
  trustProxy: parseTrustProxy(_env.TRUST_PROXY),
  cors: {
    allowedOrigins: _env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
  },
  r2: {
    accountId: _env.R2_ACCOUNT_ID,
    bucketName: _env.R2_BUCKET_NAME,
    accessKeyId: _env.R2_ACCESS_KEY_ID,
    secretAccessKey: _env.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: _env.R2_PUBLIC_BASE_URL,
    presignedUrlExpiresIn: _env.R2_PRESIGNED_URL_EXPIRES_IN_SECONDS,
    avatarMaxFileSizeMb: _env.R2_AVATAR_MAX_FILE_SIZE_MB,
  },
  notification: {
    workerEnabled: _env.NOTIFICATION_WORKER_ENABLED !== "false",
    workerIntervalMs: _env.NOTIFICATION_WORKER_INTERVAL_MS,
  },
  rateLimit: {
    windowMs: _env.RATE_LIMIT_WINDOW_MS,
    maxRequests: _env.RATE_LIMIT_MAX_REQUESTS,
    authWindowMs: _env.AUTH_RATE_LIMIT_WINDOW_MS,
    authMaxRequests: _env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  },
  encryption: {
    key: resolveEncryptionKey(),
  },
  redis: resolveRedisConfig(),
  webhook: {
    maxAttempts: _env.WEBHOOK_MAX_ATTEMPTS,
    timeoutMs: _env.WEBHOOK_TIMEOUT_MS,
  },
  google: {
    clientId: _env.GOOGLE_CLIENT_ID,
    clientSecret: _env.GOOGLE_CLIENT_SECRET,
  },
  appUrl: _env.APP_URL,
  mail: {
    host: _env.MAIL_HOST,
    port: _env.MAIL_PORT,
    secure: _env.MAIL_SECURE === "true",
    user: _env.MAIL_USER,
    pass: _env.MAIL_PASS,
    from: _env.MAIL_FROM,
  },
} as const;
