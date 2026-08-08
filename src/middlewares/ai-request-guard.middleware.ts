import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import { envConfig } from "../config/env.config";

interface RateWindow {
  count: number;
  resetAt: number;
}

interface DailyUsage {
  count: number;
  day: string;
  warningSent: boolean;
}

interface ConcurrencyState {
  active: number;
  waiting: Array<() => void>;
}

interface StoredResponse {
  body: unknown;
  statusCode: number;
}

interface CachedResponse extends StoredResponse {
  expiresAt: number;
}

interface PendingResponse {
  promise: Promise<StoredResponse>;
  resolve: (response: StoredResponse) => void;
}

const rateWindows = new Map<string, RateWindow>();
const dailyUsages = new Map<string, DailyUsage>();
const concurrencyStates = new Map<string, ConcurrencyState>();
const responseCache = new Map<string, CachedResponse>();
const pendingResponses = new Map<string, PendingResponse>();

const ONE_MINUTE_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60_000;
const WARNING_THRESHOLD = 0.8;

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const entries = Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`);
  return `{${entries.join(",")}}`;
}

function getRequestKey(req: Request): string {
  const input = [
    req.user.id,
    req.method,
    req.originalUrl,
    stableSerialize(req.body ?? null),
  ].join("|");

  return createHash("sha256").update(input).digest("hex");
}

function getUtcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function getDailyLimit(req: Request): number {
  return req.user.role === "ADMIN"
    ? envConfig.aiGuard.adminDailyLimit
    : envConfig.aiGuard.leaderDailyLimit;
}

function getOrCreateRateWindow(userId: string, now: number): RateWindow {
  const current = rateWindows.get(userId);
  if (!current || now >= current.resetAt) {
    const fresh = { count: 0, resetAt: now + ONE_MINUTE_MS };
    rateWindows.set(userId, fresh);
    return fresh;
  }

  return current;
}

function getOrCreateDailyUsage(userId: string, now: number): DailyUsage {
  const day = getUtcDay(now);
  const current = dailyUsages.get(userId);
  if (!current || current.day !== day) {
    const fresh = { count: 0, day, warningSent: false };
    dailyUsages.set(userId, fresh);
    return fresh;
  }

  return current;
}

function createPendingResponse(): PendingResponse {
  let resolve!: (response: StoredResponse) => void;
  const promise = new Promise<StoredResponse>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function acquireSlot(userId: string): Promise<void> {
  const state = concurrencyStates.get(userId) ?? { active: 0, waiting: [] };
  concurrencyStates.set(userId, state);

  if (state.active < envConfig.aiGuard.maxConcurrentPerUser) {
    state.active += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    state.waiting.push(resolve);
  });
}

function releaseSlot(userId: string): void {
  const state = concurrencyStates.get(userId);
  if (!state) return;

  const next = state.waiting.shift();
  if (next) {
    next();
    return;
  }

  state.active = Math.max(0, state.active - 1);
  if (state.active === 0) {
    concurrencyStates.delete(userId);
  }
}

function sendStoredResponse(
  res: Response,
  response: StoredResponse,
  cacheStatus: "HIT" | "SHARED",
): void {
  res.setHeader("X-AI-Cache", cacheStatus);
  res.status(response.statusCode).json(response.body);
}

function sendRateLimitResponse(
  res: Response,
  message: string,
  code: "AI_RATE_LIMIT_EXCEEDED" | "AI_DAILY_LIMIT_EXCEEDED",
  retryAfterSeconds: number,
): void {
  res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
  res.status(429).json({ success: false, message, code });
}

export async function aiRequestGuardMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const now = Date.now();
  const userId = req.user.id;
  const requestKey = getRequestKey(req);
  const cached = responseCache.get(requestKey);

  if (cached && cached.expiresAt > now) {
    sendStoredResponse(res, cached, "HIT");
    return;
  }
  if (cached) responseCache.delete(requestKey);

  const pending = pendingResponses.get(requestKey);
  if (pending) {
    const sharedResponse = await pending.promise;
    if (!res.headersSent && !res.destroyed) {
      sendStoredResponse(res, sharedResponse, "SHARED");
    }
    return;
  }

  const rateWindow = getOrCreateRateWindow(userId, now);
  if (rateWindow.count >= envConfig.aiGuard.requestsPerMinute) {
    sendRateLimitResponse(
      res,
      "Bạn đã gửi quá nhiều yêu cầu AI trong thời gian ngắn. Vui lòng thử lại sau.",
      "AI_RATE_LIMIT_EXCEEDED",
      Math.ceil((rateWindow.resetAt - now) / 1000),
    );
    return;
  }

  const dailyUsage = getOrCreateDailyUsage(userId, now);
  const dailyLimit = getDailyLimit(req);
  if (dailyUsage.count >= dailyLimit) {
    const nextDay = Date.parse(`${dailyUsage.day}T00:00:00.000Z`) + 86_400_000;
    sendRateLimitResponse(
      res,
      "Bạn đã đạt hạn mức AI hôm nay. Vui lòng liên hệ quản trị viên nếu cần tăng hạn mức.",
      "AI_DAILY_LIMIT_EXCEEDED",
      Math.ceil((nextDay - now) / 1000),
    );
    return;
  }

  rateWindow.count += 1;
  dailyUsage.count += 1;

  if (
    !dailyUsage.warningSent &&
    dailyUsage.count >= Math.ceil(dailyLimit * WARNING_THRESHOLD)
  ) {
    dailyUsage.warningSent = true;
    console.warn(
      `[AiRequestGuard] User ${userId} has used ${dailyUsage.count}/${dailyLimit} AI requests today.`,
    );
  }

  const ownPending = createPendingResponse();
  pendingResponses.set(requestKey, ownPending);
  await acquireSlot(userId);

  res.setHeader("X-AI-Cache", "MISS");
  res.setHeader("X-AI-RateLimit-Limit", envConfig.aiGuard.requestsPerMinute);
  res.setHeader(
    "X-AI-RateLimit-Remaining",
    Math.max(0, envConfig.aiGuard.requestsPerMinute - rateWindow.count),
  );
  res.setHeader("X-AI-DailyLimit-Limit", dailyLimit);
  res.setHeader(
    "X-AI-DailyLimit-Remaining",
    Math.max(0, dailyLimit - dailyUsage.count),
  );

  const originalJson = res.json.bind(res);
  let capturedResponse: StoredResponse | null = null;
  let finalized = false;

  res.json = ((body: unknown) => {
    capturedResponse = { body, statusCode: res.statusCode };
    return originalJson(body);
  }) as Response["json"];

  const finalize = () => {
    if (finalized) return;
    finalized = true;

    const response = capturedResponse ?? {
      body: {
        success: false,
        message: "Yêu cầu AI đã kết thúc mà không có phản hồi hợp lệ.",
        code: "INTERNAL_SERVER_ERROR",
      },
      statusCode: 500,
    };

    if (response.statusCode >= 200 && response.statusCode < 300) {
      responseCache.set(requestKey, {
        ...response,
        expiresAt: Date.now() + envConfig.aiGuard.cacheTtlMs,
      });
    }

    pendingResponses.delete(requestKey);
    ownPending.resolve(response);
    releaseSlot(userId);
  };

  res.once("finish", finalize);
  res.once("close", finalize);
  next();
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const today = getUtcDay(now);

  for (const [key, cached] of responseCache.entries()) {
    if (cached.expiresAt <= now) responseCache.delete(key);
  }
  for (const [userId, window] of rateWindows.entries()) {
    if (window.resetAt <= now) rateWindows.delete(userId);
  }
  for (const [userId, usage] of dailyUsages.entries()) {
    if (usage.day !== today) dailyUsages.delete(userId);
  }
}, CLEANUP_INTERVAL_MS);

cleanupTimer.unref();
