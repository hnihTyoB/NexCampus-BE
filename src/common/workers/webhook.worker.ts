import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { envConfig } from '../../config/env.config';
import { WEBHOOK_QUEUE_NAME, WebhookJobData } from '../queues/webhook.queue';
import { decryptSecret, signHmacSha256 } from '../helpers/crypto.helper';
import { isPublicHttpUrl, resolveAndValidateDns } from '../helpers/url.helper';
import { integrationRepository } from '../../modules/integration/integration.repository';
import {
  WEBHOOK_STATUS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '../constants/integration.constant';

export interface WebhookExecutionResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
}

export class WebhookWorker {
  private worker?: Worker<WebhookJobData>;
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

      this.worker = new Worker<WebhookJobData>(
        WEBHOOK_QUEUE_NAME,
        async (job: Job<WebhookJobData>) => {
          await this.processJob(job.data, job.attemptsMade);
        },
        {
          connection: this.redisConnection,
          concurrency: 5,
        },
      );

      this.worker.on('completed', (job) => {
        console.log(`[WebhookWorker] ✅ Webhook delivery ${job.data.deliveryId} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(
          `[WebhookWorker] ❌ Webhook delivery ${job?.data.deliveryId} failed attempt ${(job?.attemptsMade || 0) + 1}: ${err.message}`,
        );
      });
    } catch (err: any) {
      console.warn('[WebhookWorker] Could not connect to Redis for Webhook Worker:', err?.message);
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close().catch(() => {});
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
  }

  /**
   * Xử lý gửi 1 webhook job: SSRF check -> Decrypt Secret -> Sign HMAC -> HTTP POST -> Log DB.
   */
  async processJob(
    data: WebhookJobData,
    attemptsMade: number = 0,
    customFetcher?: (url: string, init: RequestInit) => Promise<Response>,
  ): Promise<WebhookExecutionResult> {
    const currentAttempt = attemptsMade + 1;
    const maxAttempts = envConfig.webhook.maxAttempts || WEBHOOK_MAX_ATTEMPTS;

    // 1. SSRF Safety Check: Cú pháp URL & DNS Resolution
    const isUrlSyntaxValid = isPublicHttpUrl(data.url);
    if (!isUrlSyntaxValid) {
      const errorMsg = `SSRF Check Failed: URL '${data.url}' contains private, loopback or invalid host`;
      await integrationRepository.updateDeliveryStatus(data.deliveryId, {
        status: WEBHOOK_STATUS.FAILED,
        attempts: currentAttempt,
        lastError: errorMsg,
      }).catch(() => {});
      return { success: false, error: errorMsg };
    }

    // DNS check nếu đang ở production
    if (envConfig.nodeEnv === 'production') {
      try {
        const parsed = new URL(data.url);
        const dnsCheck = await resolveAndValidateDns(parsed.hostname);
        if (!dnsCheck.isValid) {
          const errorMsg = `SSRF DNS Check Failed: ${dnsCheck.reason}`;
          await integrationRepository.updateDeliveryStatus(data.deliveryId, {
            status: WEBHOOK_STATUS.FAILED,
            attempts: currentAttempt,
            lastError: errorMsg,
          }).catch(() => {});
          return { success: false, error: errorMsg };
        }
      } catch (err: any) {
        return { success: false, error: `Invalid URL: ${err?.message}` };
      }
    }

    // 2. Decrypt HMAC secret
    let plainSecret: string;
    try {
      plainSecret = decryptSecret(data.encryptedSecret);
    } catch (err: any) {
      const errorMsg = `Failed to decrypt webhook secret: ${err?.message}`;
      await integrationRepository.updateDeliveryStatus(data.deliveryId, {
        status: WEBHOOK_STATUS.FAILED,
        attempts: currentAttempt,
        lastError: errorMsg,
      }).catch(() => {});
      return { success: false, error: errorMsg };
    }

    // 3. Serialize payload & compute HMAC signature
    const payloadString = JSON.stringify(data.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const { header: signatureHeader, signature } = signHmacSha256(payloadString, plainSecret, timestamp);

    // 4. Update status to PROCESSING
    await integrationRepository.updateDeliveryStatus(data.deliveryId, {
      status: WEBHOOK_STATUS.PROCESSING,
      signature,
      attempts: currentAttempt,
    }).catch(() => {});

    // 5. Send HTTP POST request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), envConfig.webhook.timeoutMs || 10000);

    let statusCode: number | undefined;
    let responseText = '';

    try {
      const fetchFn = customFetcher || fetch;
      const res = await fetchFn(data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'App-Webhook-Dispatcher/1.0',
          [WEBHOOK_EVENT_HEADER]: data.event,
          [WEBHOOK_DELIVERY_HEADER]: data.deliveryId,
          [WEBHOOK_SIGNATURE_HEADER]: signatureHeader,
          [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
        },
        body: payloadString,
        signal: controller.signal,
      });

      statusCode = res.status;
      try {
        responseText = (await res.text()).slice(0, 1000);
      } catch {
        responseText = '';
      }

      if (res.ok) {
        // HTTP 2xx -> Success
        await integrationRepository.updateDeliveryStatus(data.deliveryId, {
          status: WEBHOOK_STATUS.SUCCESS,
          statusCode,
          responseBody: responseText,
          deliveredAt: new Date(),
          lastError: null,
          attempts: currentAttempt,
        }).catch(() => {});

        return { success: true, statusCode, responseBody: responseText };
      } else {
        // Non-2xx response -> Fail and trigger retry if attempts remain
        const isFinalFail = currentAttempt >= maxAttempts;
        const errorMsg = `Webhook receiver responded with HTTP ${statusCode}: ${responseText}`;

        await integrationRepository.updateDeliveryStatus(data.deliveryId, {
          status: isFinalFail ? WEBHOOK_STATUS.FAILED : WEBHOOK_STATUS.PENDING,
          statusCode,
          responseBody: responseText,
          lastError: errorMsg,
          attempts: currentAttempt,
        }).catch(() => {});

        throw new Error(errorMsg);
      }
    } catch (err: any) {
      const isFinalFail = currentAttempt >= maxAttempts;
      const errorMsg = err?.message || 'Network request error';

      await integrationRepository.updateDeliveryStatus(data.deliveryId, {
        status: isFinalFail ? WEBHOOK_STATUS.FAILED : WEBHOOK_STATUS.PENDING,
        statusCode: statusCode || null,
        responseBody: responseText || null,
        lastError: errorMsg,
        attempts: currentAttempt,
      }).catch(() => {});

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const webhookWorker = new WebhookWorker();
