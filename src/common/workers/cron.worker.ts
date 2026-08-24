import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { envConfig } from '../../config/env.config';
import { CRON_QUEUE_NAME } from '../constants/cron.constant';
import { CronJobData } from '../queues/cron.queue';
import { cronService } from '../../modules/cron/cron.service';

export class CronWorker {
  private worker?: Worker<CronJobData>;
  private redisConnection?: IORedis;

  start(): void {
    if (!envConfig.redis.enabled || process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      this.redisConnection = new IORedis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 1000);
        },
      });

      this.worker = new Worker<CronJobData>(
        CRON_QUEUE_NAME,
        async (job: Job<CronJobData>) => {
          console.log(`[CronWorker] ⏳ Processing scheduled job: '${job.data.jobName}'...`);
          await cronService.triggerJob(job.data.jobName, job.data.params || {}, {
            actorId: undefined,
          });
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      this.worker.on('completed', (job) => {
        console.log(`[CronWorker] ✅ Job '${job.data.jobName}' completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`[CronWorker] ❌ Job '${job?.data?.jobName}' failed:`, err.message);
      });

      console.log('[CronWorker] Background worker started successfully');
    } catch (err: any) {
      console.error('[CronWorker] Failed to start BullMQ worker:', err.message);
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
      this.redisConnection = undefined;
    }
  }
}

export const cronWorker = new CronWorker();
