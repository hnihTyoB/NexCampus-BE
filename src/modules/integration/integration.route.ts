import { Router } from 'express';
import { IntegrationController } from './integration.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { apiKeyAuthMiddleware } from '../../middlewares/api-key.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createApiKeySchema,
  apiKeyIdParamSchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
  deliveryIdParamSchema,
  listDeliveriesQuerySchema,
  triggerJobSchema,
} from './integration.validation';

const router = Router();
const controller = new IntegrationController();

// ── API Key Management (User / Admin via JWT Auth) ───────────────────────────
router.post(
  '/api-keys',
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(createApiKeySchema),
  controller.createApiKey,
);

router.get(
  '/api-keys',
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_READ),
  controller.listApiKeys,
);

router.delete(
  '/api-keys/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(apiKeyIdParamSchema, 'params'),
  controller.deleteApiKey,
);

router.patch(
  '/api-keys/:id/toggle',
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(apiKeyIdParamSchema, 'params'),
  controller.toggleApiKey,
);

// ── Webhook Endpoint Management (User / Admin via JWT Auth) ──────────────────
router.post(
  '/webhooks',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(createWebhookSchema),
  controller.createWebhook,
);

router.get(
  '/webhooks',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  controller.listWebhooks,
);

router.get(
  '/webhooks/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(webhookIdParamSchema, 'params'),
  controller.getWebhookById,
);

router.put(
  '/webhooks/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, 'params'),
  validate(updateWebhookSchema),
  controller.updateWebhook,
);

router.delete(
  '/webhooks/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, 'params'),
  controller.deleteWebhook,
);

router.post(
  '/webhooks/:id/test',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, 'params'),
  controller.testPingWebhook,
);

router.get(
  '/webhooks/:id/deliveries',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(webhookIdParamSchema, 'params'),
  validate(listDeliveriesQuerySchema, 'query'),
  controller.listDeliveries,
);

router.post(
  '/webhooks/deliveries/:deliveryId/retry',
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(deliveryIdParamSchema, 'params'),
  controller.retryDelivery,
);

// ── Third-Party Integration Endpoint (Authenticated via API Key) ─────────────
router.post(
  '/jobs/trigger',
  apiKeyAuthMiddleware,
  validate(triggerJobSchema),
  controller.triggerDemoJob,
);

export default router;
