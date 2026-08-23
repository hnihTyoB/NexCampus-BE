import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { envConfig } from '../../config/env.config';
import { WEBHOOK_MAX_ATTEMPTS, WEBHOOK_EXPONENTIAL_DELAY_MS } from '../constants/integration.constant';

export interface WebhookJobData {
  deliveryId: string;
  webhookEndpointId: string;
  userId: string;
  event: string;
  url: string;
  encryptedSecret: string;
  payload: Record<string, unknown>;
}

export const WEBHOOK_QUEUE_NAME = 'webhook-delivery-queue';

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.env.npm_lifecycle_event === 'test';

class WebhookQueueService {
  private queue?: Queue<WebhookJobData>;
  private redisConnection?: IORedis;
  private isRedisAvailable = false;
  private inMemoryQueue: Array<{ id: string; data: WebhookJobData; attemptsMade: number }> = [];

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.init();
    }
  }

  private init() {
    try {
      this.redisConnection = new IORedis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null; // Stop retrying after 2 attempts
          }
          return Math.min(times * 200, 500);
        },
      });

      this.redisConnection.on('connect', () => {
        this.isRedisAvailable = true;
      });

      this.redisConnection.on('error', () => {
        this.isRedisAvailable = false;
      });

      const queueOptions: QueueOptions = {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: envConfig.webhook.maxAttempts || WEBHOOK_MAX_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: WEBHOOK_EXPONENTIAL_DELAY_MS,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      };

      this.queue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, queueOptions);
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Đẩy job webhook vào hàng đợi BullMQ (hoặc fallback in-memory nếu không có Redis).
   */
  async enqueue(data: WebhookJobData): Promise<{ jobId: string }> {
    if (this.isRedisAvailable && this.queue) {
      try {
        const job = await this.queue.add('dispatch-webhook', data, {
          jobId: data.deliveryId,
        });
        return { jobId: job.id || data.deliveryId };
      } catch {
        // Fallback in-memory
      }
    }

    // In-memory fallback
    this.inMemoryQueue.push({ id: data.deliveryId, data, attemptsMade: 0 });
    return { jobId: data.deliveryId };
  }

  getQueueInstance(): Queue<WebhookJobData> | undefined {
    return this.queue;
  }

  getRedisConnection(): IORedis | undefined {
    return this.redisConnection;
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close().catch(() => {});
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
  }
}

export const webhookQueue = new WebhookQueueService();
