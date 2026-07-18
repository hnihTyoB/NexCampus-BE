import { Request, Response, NextFunction } from "express";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 1000;

// Clean up expired records every 15 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(ip);
    }
  }
}, WINDOW_MS);


export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  const now = Date.now();

  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
      code: "RATE_LIMIT_EXCEEDED",
    });
    return;
  }

  next();
}
