import { prisma } from '../../database/prisma.client';
import { Prisma } from '@prisma/client';

export class IntegrationRepository {
  async createApiKey(data: {
    name: string;
    keyHash: string;
    prefix: string;
    userId: string;
    permissions: string[];
    expiresAt?: Date | null;
  }) {
    return prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash: data.keyHash,
        prefix: data.prefix,
        userId: data.userId,
        permissions: data.permissions as unknown as Prisma.InputJsonValue,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findApiKeysByUserId(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findApiKeyById(userId: string, id: string) {
    return prisma.apiKey.findFirst({
      where: { id, userId },
    });
  }

  async deleteApiKey(userId: string, id: string) {
    return prisma.apiKey.deleteMany({
      where: { id, userId },
    });
  }

  async toggleApiKey(userId: string, id: string, isActive: boolean) {
    return prisma.apiKey.updateMany({
      where: { id, userId },
      data: { isActive },
    });
  }

  async createWebhook(data: {
    userId: string;
    url: string;
    encryptedSecret: string;
    events: string[];
    description?: string;
  }) {
    return prisma.webhookEndpoint.create({
      data: {
        userId: data.userId,
        url: data.url,
        encryptedSecret: data.encryptedSecret,
        events: data.events as unknown as Prisma.InputJsonValue,
        description: data.description,
      },
    });
  }

  async findWebhooksByUserId(userId: string) {
    return prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWebhookById(userId: string, id: string) {
    return prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });
  }

  async updateWebhook(
    userId: string,
    id: string,
    data: {
      url?: string;
      encryptedSecret?: string;
      events?: string[];
      isActive?: boolean;
      description?: string;
    },
  ) {
    const updateData: Prisma.WebhookEndpointUpdateInput = {};
    if (data.url !== undefined) updateData.url = data.url;
    if (data.encryptedSecret !== undefined) updateData.encryptedSecret = data.encryptedSecret;
    if (data.events !== undefined) updateData.events = data.events as unknown as Prisma.InputJsonValue;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.description !== undefined) updateData.description = data.description;

    return prisma.webhookEndpoint.updateMany({
      where: { id, userId },
      data: updateData,
    });
  }

  async deleteWebhook(userId: string, id: string) {
    return prisma.webhookEndpoint.deleteMany({
      where: { id, userId },
    });
  }

  async findActiveWebhooksForUser(userId: string) {
    return prisma.webhookEndpoint.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  async createDelivery(data: {
    webhookEndpointId: string;
    userId: string;
    event: string;
    payload: Record<string, unknown>;
    signature: string;
    status: string;
  }) {
    return prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: data.webhookEndpointId,
        userId: data.userId,
        event: data.event,
        payload: data.payload as unknown as Prisma.InputJsonValue,
        signature: data.signature,
        status: data.status,
      },
    });
  }

  async findDeliveriesByWebhookId(
    webhookEndpointId: string,
    userId: string,
    options: {
      page: number;
      limit: number;
      status?: string;
      event?: string;
    },
  ) {
    const where: Prisma.WebhookDeliveryWhereInput = {
      webhookEndpointId,
      userId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.event ? { event: options.event } : {}),
    };

    const skip = (options.page - 1) * options.limit;
    const [items, total] = await prisma.$transaction([
      prisma.webhookDelivery.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    const totalPages = Math.ceil(total / options.limit);

    return { items, total, page: options.page, limit: options.limit, totalPages };
  }

  async findDeliveryById(deliveryId: string, userId: string) {
    return prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, userId },
      include: {
        webhookEndpoint: true,
      },
    });
  }

  async updateDeliveryStatus(
    deliveryId: string,
    data: {
      status: string;
      signature?: string;
      statusCode?: number | null;
      responseBody?: string | null;
      attempts: number;
      lastError?: string | null;
      deliveredAt?: Date | null;
    },
  ) {
    return prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data,
    });
  }

  async findApiKeyByKeyHash(keyHash: string) {
    return prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          include: { role: true },
        },
      },
    });
  }

  async updateApiKeyLastUsed(id: string) {
    return prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: (data.details as any) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

export const integrationRepository = new IntegrationRepository();


