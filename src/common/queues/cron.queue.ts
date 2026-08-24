import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { envConfig } from '../../config/env.config';
import {
  CRON_QUEUE_NAME,
  CRON_JOB_NAMES,
  CronJobName,
  DEFAULT_CRON_SCHEDULES,
} from '../constants/cron.constant';

export interface CronJobData {
  jobName: CronJobName;
  triggeredAt: string;
  params?: Record<string, unknown>;
}

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.env.npm_lifecycle_event === 'test';

export class CronQueueService {
  private queue?: Queue<CronJobData>;
  private redisConnection?: IORedis;
  private isRedisAvailable = false;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.init();
    }
  }

  private init(): void {
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
            return null;
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
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      };

      this.queue = new Queue<CronJobData>(CRON_QUEUE_NAME, queueOptions);
    } catch {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Đăng ký tất cả các Repeatable Cron Jobs theo biểu thức cron chuẩn
   */
  async registerSchedules(): Promise<void> {
    if (!this.queue || !this.isRedisAvailable) return;

    try {
      for (const [jobName, config] of Object.entries(DEFAULT_CRON_SCHEDULES)) {
        await this.queue.upsertJobScheduler(
          jobName,
          { pattern: config.cron },
          {
            name: jobName,
            data: {
              jobName: jobName as CronJobName,
              triggeredAt: new Date().toISOString(),
            },
          },
        );
      }
      console.log('[CronQueue] Repeatable cron jobs successfully registered');
    } catch (err: any) {
      console.warn('[CronQueue] Failed to register repeatable schedules:', err.message);
    }
  }


  /**
   * Đưa 1 job vào hàng đợi thực thi ngay lập tức
   */
  async triggerJob(jobName: CronJobName, params?: Record<string, unknown>): Promise<{ jobId: string }> {
    const data: CronJobData = {
      jobName,
      triggeredAt: new Date().toISOString(),
      params,
    };

    if (this.queue && this.isRedisAvailable) {
      const job = await this.queue.add(`manual:${jobName}`, data);
      return { jobId: job.id || `manual-${Date.now()}` };
    }

    return { jobId: `direct-${Date.now()}` };
  }

  getQueueInstance(): Queue<CronJobData> | undefined {
    return this.queue;
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close().catch(() => {});
      this.queue = undefined;
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
      this.redisConnection = undefined;
    }
    this.isRedisAvailable = false;
  }
}

export const cronQueue = new CronQueueService();
