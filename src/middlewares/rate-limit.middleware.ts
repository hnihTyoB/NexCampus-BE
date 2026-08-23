import { Request, Response, NextFunction } from 'express';
import { ERROR_CODE } from '../common/errors/error-code';
import { envConfig } from '../config/env.config';

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Factory tạo Rate Limiter Middleware có cơ chế sliding-window đếm request,
 * trả về HTTP headers chuẩn RFC 6585 (Retry-After, X-RateLimit-*),
 * và tự động dọn dẹp bộ nhớ định kỳ.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? envConfig.rateLimit.windowMs;
  const maxRequests = options.maxRequests ?? envConfig.rateLimit.maxRequests;
  const message = options.message ?? 'Too many requests, please try again later';
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  // Dọn dẹp định kỳ các record đã hết hạn để ngăn ngừa rò rỉ bộ nhớ
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts.entries()) {
      if (now > record.resetAt) {
        requestCounts.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();

    const record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      const resetAt = now + windowMs;
      requestCounts.set(key, { count: 1, resetAt });

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

      next();
      return;
    }

    record.count += 1;
    const remaining = Math.max(0, maxRequests - record.count);
    const resetTimeSeconds = Math.ceil(record.resetAt / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        message,
        code: ERROR_CODE.RATE_LIMIT_EXCEEDED,
      });
      return;
    }

    next();
  };
}

/**
 * Rate Limiter chung cho toàn bộ API routes (/api/v1): cấu hình động từ RATE_LIMIT_MAX_REQUESTS & RATE_LIMIT_WINDOW_MS
 */
export const rateLimitMiddleware = createRateLimiter({
  windowMs: envConfig.rateLimit.windowMs,
  maxRequests: envConfig.rateLimit.maxRequests,
  message: 'Too many requests, please try again later',
});

/**
 * Rate Limiter nghiêm ngặt dành riêng cho các auth endpoints nhạy cảm
 * (login, register, forgot-password, resend-verification, reset-password): cấu hình động từ AUTH_RATE_LIMIT_MAX_REQUESTS & AUTH_RATE_LIMIT_WINDOW_MS
 */
export const authRateLimitMiddleware = createRateLimiter({
  windowMs: envConfig.rateLimit.authWindowMs,
  maxRequests: envConfig.rateLimit.authMaxRequests,
  message: 'Too many authentication attempts, please try again later',
});

