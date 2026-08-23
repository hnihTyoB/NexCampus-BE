export const WEBHOOK_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export type WebhookStatus = keyof typeof WEBHOOK_STATUS;

export const WEBHOOK_EVENTS = {
  ALL: '*',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  SYSTEM_PING: 'system.ping',
  USER_UPDATED: 'user.updated',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const API_KEY_PREFIX = 'ak_live_';
export const API_KEY_HEADER = 'x-api-key';
export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-webhook-timestamp';
export const WEBHOOK_EVENT_HEADER = 'x-webhook-event';
export const WEBHOOK_DELIVERY_HEADER = 'x-webhook-delivery';

export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_EXPONENTIAL_DELAY_MS = 10000; // 10s base delay -> 10s, 20s, 40s, 80s, 160s
