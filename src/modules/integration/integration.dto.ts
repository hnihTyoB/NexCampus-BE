export interface CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresAt?: string | Date;
}

export interface CreateApiKeyResponseDto {
  id: string;
  name: string;
  key: string; // Plaintext key trả về duy nhất 1 lần
  prefix: string;
  permissions: string[];
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ApiKeyItemDto {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface CreateWebhookDto {
  url: string;
  secret?: string; // Tự cung cấp secret hoặc để hệ thống tự sinh ngẫu nhiên
  events?: string[];
  description?: string;
}

export interface UpdateWebhookDto {
  url?: string;
  events?: string[];
  isActive?: boolean;
  description?: string;
  secret?: string;
}

export interface WebhookEndpointDto {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  secretMasked: string; // Hiển thị dạng "whsec_..."
}

export interface WebhookDeliveryDto {
  id: string;
  webhookEndpointId: string;
  event: string;
  payload: unknown;
  signature: string;
  status: string;
  statusCode?: number | null;
  responseBody?: string | null;
  attempts: number;
  lastError?: string | null;
  deliveredAt?: Date | null;
  createdAt: Date;
}

export interface TriggerJobDto {
  taskName: string;
  data: Record<string, unknown>;
  simulateError?: boolean;
}
