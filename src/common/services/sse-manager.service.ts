import { Request, Response } from 'express';
import IORedis from 'ioredis';
import { envConfig } from '../../config/env.config';

export interface SseEvent<T = unknown> {
  type: string;
  data: T;
  id?: string;
}

interface RedisSseMessage {
  target: 'user' | 'broadcast';
  userId?: string;
  event: SseEvent;
}

const SSE_PUBSUB_CHANNEL = 'sse:events:stream';

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.env.npm_lifecycle_event === 'test';

export class SseManagerService {
  private readonly userStreams = new Map<string, Set<Response>>();
  private readonly globalStreams = new Set<Response>();
  private redisPublisher?: IORedis;
  private redisSubscriber?: IORedis;
  private isRedisAvailable = false;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.initRedisPubSub();
    }
    this.startHeartbeat();
  }

  private initRedisPubSub(): void {
    try {
      const redisOptions = {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 500);
        },
      };

      this.redisPublisher = new IORedis(redisOptions);
      this.redisSubscriber = new IORedis(redisOptions);

      this.redisSubscriber.on('connect', () => {
        this.isRedisAvailable = true;
        this.redisSubscriber?.subscribe(SSE_PUBSUB_CHANNEL, (err) => {
          if (err) {
            console.error('[SseManagerService] Redis subscribe error:', err.message);
          }
        });
      });

      this.redisSubscriber.on('message', (channel, message) => {
        if (channel === SSE_PUBSUB_CHANNEL) {
          try {
            const parsed = JSON.parse(message) as RedisSseMessage;
            if (parsed.target === 'user' && parsed.userId) {
              this.deliverToLocalUser(parsed.userId, parsed.event);
            } else if (parsed.target === 'broadcast') {
              this.deliverToLocalBroadcast(parsed.event);
            }
          } catch (err: any) {
            console.warn('[SseManagerService] Error parsing Redis SSE message:', err.message);
          }
        }
      });

      this.redisSubscriber.on('error', () => {
        this.isRedisAvailable = false;
      });
      this.redisPublisher.on('error', () => {
        this.isRedisAvailable = false;
      });

      this.redisSubscriber.connect().catch(() => {
        this.isRedisAvailable = false;
      });
      this.redisPublisher.connect().catch(() => {
        this.isRedisAvailable = false;
      });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Khởi chạy định kỳ gửi comment heartbeat (: keep-alive) mỗi 25s
   * để ngăn chặn reverse proxy (Cloudflare, Nginx, AWS ALB) đóng kết nối do idle timeout.
   */
  private startHeartbeat(): void {
    const HEARTBEAT_INTERVAL_MS = 25 * 1000;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  private sendHeartbeat(): void {
    const heartbeatComment = `: keep-alive\n\n`;

    // Send to all user streams
    for (const streams of this.userStreams.values()) {
      for (const res of streams) {
        if (!res.writableEnded) {
          res.write(heartbeatComment);
        }
      }
    }

    // Send to global streams
    for (const res of this.globalStreams) {
      if (!res.writableEnded) {
        res.write(heartbeatComment);
      }
    }
  }

  /**
   * Đăng ký một HTTP response stream làm kênh nhận Server-Sent Events cho User
   */
  registerClient(userId: string, res: Response, req: Request): void {
    // 1. Thiết lập các HTTP Headers chuẩn SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Tắt buffering của Nginx reverse proxy
    res.flushHeaders?.();

    // 2. Lưu trữ connection vào Set theo userId
    let userSet = this.userStreams.get(userId);
    if (!userSet) {
      userSet = new Set<Response>();
      this.userStreams.set(userId, userSet);
    }
    userSet.add(res);

    // 3. Gửi sự kiện ban đầu thông báo kết nối thành công
    this.sendRaw(res, {
      type: 'connected',
      data: {
        status: 'connected',
        serverTime: new Date().toISOString(),
      },
    });

    // 4. Lắng nghe sự kiện ngắt kết nối để giải phóng bộ nhớ
    req.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  private removeClient(userId: string, res: Response): void {
    const userSet = this.userStreams.get(userId);
    if (userSet) {
      userSet.delete(res);
      if (userSet.size === 0) {
        this.userStreams.delete(userId);
      }
    }
    this.globalStreams.delete(res);
  }

  /**
   * Gửi sự kiện thời gian thực tới 1 người dùng cụ thể (tất cả các tab/thiết bị của user đó)
   */
  sendToUser(userId: string, event: SseEvent): void {
    // 1. Nếu có Redis, broadcast lên channel để các pod khác trong cluster cùng nhận
    if (this.isRedisAvailable && this.redisPublisher) {
      const msg: RedisSseMessage = { target: 'user', userId, event };
      this.redisPublisher.publish(SSE_PUBSUB_CHANNEL, JSON.stringify(msg)).catch(() => {});
    }

    // 2. Deliver cho các kết nối nội bộ của instance hiện tại
    this.deliverToLocalUser(userId, event);
  }

  /**
   * Gửi sự kiện quảng bá tới toàn bộ người dùng đang online (Broadcast)
   */
  broadcast(event: SseEvent): void {
    // 1. Broadcast qua Redis cho toàn bộ cluster
    if (this.isRedisAvailable && this.redisPublisher) {
      const msg: RedisSseMessage = { target: 'broadcast', event };
      this.redisPublisher.publish(SSE_PUBSUB_CHANNEL, JSON.stringify(msg)).catch(() => {});
    }

    // 2. Deliver nội bộ
    this.deliverToLocalBroadcast(event);
  }

  private deliverToLocalUser(userId: string, event: SseEvent): void {
    const streams = this.userStreams.get(userId);
    if (!streams || streams.size === 0) return;

    for (const res of streams) {
      if (!res.writableEnded) {
        this.sendRaw(res, event);
      }
    }
  }

  private deliverToLocalBroadcast(event: SseEvent): void {
    for (const streams of this.userStreams.values()) {
      for (const res of streams) {
        if (!res.writableEnded) {
          this.sendRaw(res, event);
        }
      }
    }

    for (const res of this.globalStreams) {
      if (!res.writableEnded) {
        this.sendRaw(res, event);
      }
    }
  }

  private sendRaw(res: Response, event: SseEvent): void {
    try {
      let payload = '';
      if (event.id) {
        payload += `id: ${event.id}\n`;
      }
      payload += `event: ${event.type}\n`;
      payload += `data: ${JSON.stringify(event.data)}\n\n`;

      res.write(payload);
    } catch (err: any) {
      console.warn('[SseManagerService] Failed to write event to stream:', err.message);
    }
  }

  /**
   * Lấy tổng số lượng kết nối SSE đang mở trên server
   */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const set of this.userStreams.values()) {
      count += set.size;
    }
    return count + this.globalStreams.size;
  }

  /**
   * Đóng toàn bộ kết nối khi server dừng (Graceful Shutdown)
   */
  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Gửi tín hiệu ngắt kết nối cho các client
    const shutdownEvent: SseEvent = {
      type: 'shutdown',
      data: { message: 'Server is restarting or shutting down' },
    };

    for (const streams of this.userStreams.values()) {
      for (const res of streams) {
        if (!res.writableEnded) {
          this.sendRaw(res, shutdownEvent);
          res.end();
        }
      }
    }
    this.userStreams.clear();

    for (const res of this.globalStreams) {
      if (!res.writableEnded) {
        this.sendRaw(res, shutdownEvent);
        res.end();
      }
    }
    this.globalStreams.clear();

    if (this.redisSubscriber) {
      this.redisSubscriber.disconnect();
      this.redisSubscriber = undefined;
    }
    if (this.redisPublisher) {
      this.redisPublisher.disconnect();
      this.redisPublisher = undefined;
    }
    this.isRedisAvailable = false;
  }
}

export const sseManagerService = new SseManagerService();
