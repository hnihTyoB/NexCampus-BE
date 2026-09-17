import crypto from "crypto";
import IORedis from "ioredis";
import { envConfig } from "../../config/env.config";
import { getRedisConnectionOptions } from "../../config/redis.config";

export interface SseTicketUser {
  id: string;
  email: string;
  role: string;
  roleId?: string;
}

interface InMemoryTicket {
  user: SseTicketUser;
  expiresAt: number;
}

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

const TICKET_TTL_SECONDS = 60;

export class SseTicketService {
  private inMemoryTickets = new Map<string, InMemoryTicket>();
  private redisClient?: IORedis;
  private isRedisAvailable = false;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.initRedis();
    }
    this.startCleanupTimer();
  }

  private initRedis(): void {
    try {
      const baseOptions = getRedisConnectionOptions();
      const redisOptions = {
        ...baseOptions,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 500);
        },
      };

      this.redisClient = new IORedis(redisOptions);

      this.redisClient.on("connect", () => {
        this.isRedisAvailable = true;
      });

      this.redisClient.on("error", () => {
        this.isRedisAvailable = false;
      });

      this.redisClient.connect().catch(() => {
        this.isRedisAvailable = false;
      });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ticket, entry] of this.inMemoryTickets.entries()) {
        if (entry.expiresAt < now) {
          this.inMemoryTickets.delete(ticket);
        }
      }
    }, 30 * 1000);
    this.cleanupTimer.unref();
  }

  /**
   * Tạo One-Time Ticket ngắn hạn (60s) cho người dùng kết nối SSE EventSource.
   */
  async createTicket(user: SseTicketUser): Promise<string> {
    const ticket = crypto.randomUUID();
    const expiresAt = Date.now() + TICKET_TTL_SECONDS * 1000;

    // Lưu vào in-memory map
    this.inMemoryTickets.set(ticket, { user, expiresAt });

    // Đồng bộ vào Redis nếu có kết nối
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.set(
          `sse:ticket:${ticket}`,
          JSON.stringify(user),
          "EX",
          TICKET_TTL_SECONDS,
        );
      } catch (err: any) {
        console.warn("[SseTicketService] Failed to persist ticket in Redis:", err.message);
      }
    }

    return ticket;
  }

  /**
   * Xác thực và tiêu thụ vé (One-Time Ticket).
   * Trả về thông tin user nếu vé hợp lệ và chưa hết hạn, đồng thời xóa vé ngay lập tức.
   */
  async validateAndConsumeTicket(ticket: string): Promise<SseTicketUser | null> {
    if (!ticket) return null;

    // 1. Kiểm tra trong bộ nhớ local trước
    const localEntry = this.inMemoryTickets.get(ticket);
    if (localEntry) {
      this.inMemoryTickets.delete(ticket);
      if (localEntry.expiresAt >= Date.now()) {
        // Xóa đồng thời trên Redis nếu có
        if (this.isRedisAvailable && this.redisClient) {
          this.redisClient.del(`sse:ticket:${ticket}`).catch(() => {});
        }
        return localEntry.user;
      }
      return null;
    }

    // 2. Nếu không tìm thấy ở local (cluster node khác), truy vấn từ Redis
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const key = `sse:ticket:${ticket}`;
        let rawData: string | null = null;
        if (typeof (this.redisClient as any).getdel === "function") {
          rawData = await (this.redisClient as any).getdel(key);
        } else {
          rawData = await this.redisClient.get(key);
          if (rawData) {
            await this.redisClient.del(key);
          }
        }

        if (rawData) {
          return JSON.parse(rawData) as SseTicketUser;
        }
      } catch (err: any) {
        console.warn("[SseTicketService] Error validating ticket from Redis:", err.message);
      }
    }

    return null;
  }

  /**
   * Đóng kết nối và dọn dẹp timer
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.inMemoryTickets.clear();
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
  }
}

export const sseTicketService = new SseTicketService();
