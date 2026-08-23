import crypto from 'node:crypto';
import { IntegrationRepository } from './integration.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import {
  CreateApiKeyDto,
  CreateApiKeyResponseDto,
  ApiKeyItemDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookEndpointDto,
  TriggerJobDto,
} from './integration.dto';
import { generateApiKey, encryptSecret } from '../../common/helpers/crypto.helper';
import { webhookQueue } from '../../common/queues/webhook.queue';
import { webhookWorker } from '../../common/workers/webhook.worker';
import {
  WEBHOOK_STATUS,
  WEBHOOK_EVENTS,
  WebhookEvent,
} from '../../common/constants/integration.constant';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class IntegrationService {
  private readonly repository = new IntegrationRepository();

  // ── API Key Business Logic ───────────────────────────────────────────────────
  async createApiKey(userId: string, data: CreateApiKeyDto): Promise<CreateApiKeyResponseDto> {
    const { plainTextKey, keyHash, displayPrefix } = generateApiKey();
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const apiKey = await this.repository.createApiKey({
      name: data.name,
      keyHash,
      prefix: displayPrefix,
      userId,
      permissions: data.permissions || [],
      expiresAt,
    });

    // Audit log
    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.CREATE_API_KEY,
      targetType: AUDIT_TARGET_TYPE.API_KEY,
      targetId: apiKey.id,
      details: { name: apiKey.name, prefix: displayPrefix },
    }).catch(() => {});

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: plainTextKey,
      prefix: displayPrefix,
      permissions: apiKey.permissions as string[],
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(userId: string): Promise<ApiKeyItemDto[]> {
    const keys = await this.repository.findApiKeysByUserId(userId);
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      permissions: (k.permissions as string[]) || [],
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }

  async deleteApiKey(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findApiKeyById(userId, id);
    if (!existing) {
      throw new AppError('API Key not found', 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.deleteApiKey(userId, id);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.REVOKE_API_KEY,
      targetType: AUDIT_TARGET_TYPE.API_KEY,
      targetId: id,
      details: { name: existing.name, prefix: existing.prefix },
    }).catch(() => {});
  }

  async toggleApiKey(userId: string, id: string, isActive: boolean): Promise<void> {
    const existing = await this.repository.findApiKeyById(userId, id);
    if (!existing) {
      throw new AppError('API Key not found', 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.toggleApiKey(userId, id, isActive);
  }

  // ── Webhook Endpoint Business Logic ──────────────────────────────────────────
  async createWebhook(
    userId: string,
    data: CreateWebhookDto,
  ): Promise<WebhookEndpointDto & { secret: string }> {
    const plainSecret = data.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const encryptedSecret = encryptSecret(plainSecret);
    const events = data.events && data.events.length > 0 ? data.events : ['*'];

    const webhook = await this.repository.createWebhook({
      userId,
      url: data.url,
      encryptedSecret,
      events,
      description: data.description,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.CREATE_WEBHOOK,
      targetType: AUDIT_TARGET_TYPE.WEBHOOK_ENDPOINT,
      targetId: webhook.id,
      details: { url: webhook.url, events },
    }).catch(() => {});

    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events as string[],
      isActive: webhook.isActive,
      description: webhook.description,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      secretMasked: `whsec_${plainSecret.slice(6, 12)}...`,
      secret: plainSecret, // Trả về 1 lần duy nhất lúc tạo
    };
  }

  async listWebhooks(userId: string): Promise<WebhookEndpointDto[]> {
    const list = await this.repository.findWebhooksByUserId(userId);
    return list.map((w) => ({
      id: w.id,
      url: w.url,
      events: (w.events as string[]) || ['*'],
      isActive: w.isActive,
      description: w.description,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      secretMasked: 'whsec_••••••••••••',
    }));
  }

  async getWebhookById(userId: string, id: string): Promise<WebhookEndpointDto> {
    const webhook = await this.repository.findWebhookById(userId, id);
    if (!webhook) {
      throw new AppError('Webhook endpoint not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return {
      id: webhook.id,
      url: webhook.url,
      events: (webhook.events as string[]) || ['*'],
      isActive: webhook.isActive,
      description: webhook.description,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      secretMasked: 'whsec_••••••••••••',
    };
  }

  async updateWebhook(userId: string, id: string, data: UpdateWebhookDto): Promise<void> {
    const existing = await this.repository.findWebhookById(userId, id);
    if (!existing) {
      throw new AppError('Webhook endpoint not found', 404, ERROR_CODE.NOT_FOUND);
    }

    let encryptedSecret: string | undefined;
    if (data.secret) {
      encryptedSecret = encryptSecret(data.secret);
    }

    await this.repository.updateWebhook(userId, id, {
      url: data.url,
      encryptedSecret,
      events: data.events,
      isActive: data.isActive,
      description: data.description,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.UPDATE_WEBHOOK,
      targetType: AUDIT_TARGET_TYPE.WEBHOOK_ENDPOINT,
      targetId: id,
      details: { url: data.url, events: data.events },
    }).catch(() => {});
  }

  async deleteWebhook(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findWebhookById(userId, id);
    if (!existing) {
      throw new AppError('Webhook endpoint not found', 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.deleteWebhook(userId, id);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.DELETE_WEBHOOK,
      targetType: AUDIT_TARGET_TYPE.WEBHOOK_ENDPOINT,
      targetId: id,
      details: { url: existing.url },
    }).catch(() => {});
  }

  // ── Webhook Dispatching & Delivery Logic ─────────────────────────────────────
  /**
   * Dispatch sự kiện tới tất cả các Webhook endpoints thuộc quyền sở hữu của `userId`
   * có đăng ký lắng nghe `event` tương ứng.
   */
  async dispatchWebhookEvent(
    userId: string,
    event: WebhookEvent | string,
    payload: Record<string, unknown>,
  ): Promise<{ dispatchedCount: number; deliveryIds: string[] }> {
    const activeEndpoints = await this.repository.findActiveWebhooksForUser(userId);

    // Lọc các webhook lắng nghe event này hoặc '*'
    const matchedEndpoints = activeEndpoints.filter((endpoint: any) => {
      const events = (endpoint.events as string[]) || [];
      return events.includes(event) || events.includes('*') || events.includes(WEBHOOK_EVENTS.ALL);
    });

    if (matchedEndpoints.length === 0) {
      return { dispatchedCount: 0, deliveryIds: [] };
    }

    const deliveryIds: string[] = [];
    const enqueueTasks: Promise<any>[] = [];

    for (const endpoint of matchedEndpoints) {
      const delivery = await this.repository.createDelivery({
        webhookEndpointId: endpoint.id,
        userId,
        event,
        payload,
        signature: 'pending',
        status: WEBHOOK_STATUS.PENDING,
      });

      deliveryIds.push(delivery.id);

      enqueueTasks.push(
        webhookQueue.enqueue({
          deliveryId: delivery.id,
          webhookEndpointId: endpoint.id,
          userId,
          event,
          url: endpoint.url,
          encryptedSecret: endpoint.encryptedSecret,
          payload,
        }),
      );
    }

    await Promise.all(enqueueTasks);

    return { dispatchedCount: matchedEndpoints.length, deliveryIds };
  }

  async testPingWebhook(userId: string, id: string): Promise<{ deliveryId: string; message: string }> {
    const webhook = await this.repository.findWebhookById(userId, id);
    if (!webhook) {
      throw new AppError('Webhook endpoint not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const testPayload = {
      event: WEBHOOK_EVENTS.SYSTEM_PING,
      timestamp: new Date().toISOString(),
      webhookId: webhook.id,
      message: 'This is a test ping delivery from your application.',
    };

    const delivery = await this.repository.createDelivery({
      webhookEndpointId: webhook.id,
      userId,
      event: WEBHOOK_EVENTS.SYSTEM_PING,
      payload: testPayload,
      signature: 'pending',
      status: WEBHOOK_STATUS.PENDING,
    });

    await webhookQueue.enqueue({
      deliveryId: delivery.id,
      webhookEndpointId: webhook.id,
      userId,
      event: WEBHOOK_EVENTS.SYSTEM_PING,
      url: webhook.url,
      encryptedSecret: webhook.encryptedSecret,
      payload: testPayload,
    });

    return {
      deliveryId: delivery.id,
      message: 'Ping webhook job has been queued for delivery',
    };
  }

  async listDeliveries(
    userId: string,
    webhookEndpointId: string,
    options: { page: number; limit: number; status?: string; event?: string },
  ) {
    const webhook = await this.repository.findWebhookById(userId, webhookEndpointId);
    if (!webhook) {
      throw new AppError('Webhook endpoint not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return this.repository.findDeliveriesByWebhookId(webhookEndpointId, userId, options);
  }

  async retryDelivery(userId: string, deliveryId: string): Promise<{ deliveryId: string; message: string }> {
    const delivery = await this.repository.findDeliveryById(deliveryId, userId);
    if (!delivery || !delivery.webhookEndpoint) {
      throw new AppError('Webhook delivery log not found', 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.updateDeliveryStatus(delivery.id, {
      status: WEBHOOK_STATUS.PENDING,
      attempts: 0,
      lastError: null,
      statusCode: null,
    });

    await webhookQueue.enqueue({
      deliveryId: delivery.id,
      webhookEndpointId: delivery.webhookEndpointId,
      userId,
      event: delivery.event,
      url: delivery.webhookEndpoint.url,
      encryptedSecret: delivery.webhookEndpoint.encryptedSecret,
      payload: delivery.payload as Record<string, unknown>,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.TRIGGER_WEBHOOK_RETRY,
      targetType: AUDIT_TARGET_TYPE.WEBHOOK_DELIVERY,
      targetId: deliveryId,
      details: { event: delivery.event },
    }).catch(() => {});

    return {
      deliveryId: delivery.id,
      message: 'Webhook delivery retry has been queued',
    };
  }

  // ── Demo Job Endpoint Logic (Third-Party Trigger) ────────────────────────────
  async triggerDemoJob(
    userId: string,
    data: TriggerJobDto,
  ): Promise<{ jobId: string; status: string; taskName: string; webhooksNotified: number }> {
    const jobId = `job_${crypto.randomUUID()}`;
    const isSuccess = !data.simulateError;
    const event = isSuccess ? WEBHOOK_EVENTS.JOB_COMPLETED : WEBHOOK_EVENTS.JOB_FAILED;

    const jobResultPayload = {
      jobId,
      taskName: data.taskName,
      status: isSuccess ? 'COMPLETED' : 'FAILED',
      result: isSuccess ? { processed: true, data: data.data } : { error: 'Simulated task execution error' },
      executedAt: new Date().toISOString(),
    };

    // Tự động tìm tất cả Webhook của chủ sở hữu job (userId) và gửi callback
    const { dispatchedCount } = await this.dispatchWebhookEvent(userId, event, jobResultPayload);

    return {
      jobId,
      taskName: data.taskName,
      status: isSuccess ? 'COMPLETED' : 'FAILED',
      webhooksNotified: dispatchedCount,
    };
  }
}
