import { Router } from "express";
import { IntegrationController } from "./integration.controller";
import { discordWebhookController } from "./discord-webhook.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { apiKeyAuthMiddleware } from "../../middlewares/api-key.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  createApiKeySchema,
  apiKeyIdParamSchema,
  toggleApiKeySchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
  deliveryIdParamSchema,
  listDeliveriesQuerySchema,
  triggerJobSchema,
  createDiscordWebhookSchema,
  updateDiscordWebhookSchema,
  discordWebhookIdParamSchema,
  discordDepartmentParamSchema,
  testDiscordWebhookSchema,
  findAllDiscordWebhooksQuerySchema,
} from "./integration.validation";

const router = Router();
const controller = new IntegrationController();

// ── API Key Management (User / Admin via JWT Auth) ───────────────────────────
router.post(
  "/api-keys",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(createApiKeySchema),
  controller.createApiKey,
);

router.get(
  "/api-keys",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_READ),
  controller.listApiKeys,
);

router.delete(
  "/api-keys/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(apiKeyIdParamSchema, "params"),
  controller.deleteApiKey,
);

router.patch(
  "/api-keys/:id/toggle",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEY_MANAGE),
  validate(apiKeyIdParamSchema, "params"),
  validate(toggleApiKeySchema),
  controller.toggleApiKey,
);

// ── Webhook Endpoint Management (User / Admin via JWT Auth) ──────────────────
router.post(
  "/webhooks",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(createWebhookSchema),
  controller.createWebhook,
);

router.get(
  "/webhooks",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  controller.listWebhooks,
);

router.get(
  "/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(webhookIdParamSchema, "params"),
  controller.getWebhookById,
);

router.put(
  "/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, "params"),
  validate(updateWebhookSchema),
  controller.updateWebhook,
);

router.delete(
  "/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, "params"),
  controller.deleteWebhook,
);

router.post(
  "/webhooks/:id/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(webhookIdParamSchema, "params"),
  controller.testPingWebhook,
);

router.get(
  "/webhooks/:id/deliveries",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(webhookIdParamSchema, "params"),
  validate(listDeliveriesQuerySchema, "query"),
  controller.listDeliveries,
);

router.post(
  "/webhooks/deliveries/:deliveryId/retry",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(deliveryIdParamSchema, "params"),
  controller.retryDelivery,
);

// ── Third-Party Integration Endpoint (Authenticated via API Key) ─────────────
router.post(
  "/jobs/trigger",
  apiKeyAuthMiddleware,
  validate(triggerJobSchema),
  controller.triggerDemoJob,
);

// ── Discord Webhook Endpoints ───────────────────────────────────────────────

// List Discord Webhooks
router.get(
  "/discord/webhooks",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(findAllDiscordWebhooksQuerySchema, "query"),
  discordWebhookController.listWebhooks,
);
router.get(
  "/webhooks/discord",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(findAllDiscordWebhooksQuerySchema, "query"),
  discordWebhookController.listWebhooks,
);

// Get Discord Webhook by ID
router.get(
  "/discord/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.getWebhookById,
);
router.get(
  "/webhooks/discord/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.getWebhookById,
);

// Create or Update Discord Webhook
router.post(
  "/discord/webhooks",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(createDiscordWebhookSchema),
  discordWebhookController.createOrUpdateWebhook,
);
router.post(
  "/webhooks/discord",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(createDiscordWebhookSchema),
  discordWebhookController.createOrUpdateWebhook,
);

// Update Discord Webhook
router.put(
  "/discord/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  validate(updateDiscordWebhookSchema),
  discordWebhookController.updateWebhook,
);
router.put(
  "/webhooks/discord/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  validate(updateDiscordWebhookSchema),
  discordWebhookController.updateWebhook,
);

// Delete Discord Webhook
router.delete(
  "/discord/webhooks/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.deleteWebhook,
);
router.delete(
  "/webhooks/discord/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.deleteWebhook,
);

// Test Ping Discord Webhook
router.post(
  "/discord/webhooks/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(testDiscordWebhookSchema),
  discordWebhookController.testPingWebhook,
);
router.post(
  "/webhooks/discord/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(testDiscordWebhookSchema),
  discordWebhookController.testPingWebhook,
);
router.post(
  "/discord/webhooks/:id/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.testPingWebhook,
);
router.post(
  "/webhooks/discord/:id/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordWebhookIdParamSchema, "params"),
  discordWebhookController.testPingWebhook,
);

// ── Discord Bot Automation & Provisioning ───────────────────────────────────

// Check Discord Bot status
router.get(
  "/discord/status",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_READ),
  discordWebhookController.getBotStatus,
);

// Provision ALL Departments at once (bulk provisioning for existing departments)
// NOTE: Must be placed BEFORE /:id/provision to prevent "provision-all" being matched as :id
router.post(
  "/discord/departments/provision-all",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  discordWebhookController.provisionAllDepartments,
);

// Quick Provision Role & Private Thread for a specific Department
router.post(
  "/discord/departments/:id/provision",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  validate(discordDepartmentParamSchema, "params"),
  discordWebhookController.provisionDepartment,
);

// Batch Discord Role Synchronization (Quét & Đồng Bộ Role Hàng Loạt)
router.post(
  "/discord/sync-roles",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  discordWebhookController.batchSyncRoles,
);
router.post(
  "/webhooks/discord/sync-roles",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  discordWebhookController.batchSyncRoles,
);

// Send reminder email to all unlinked interns
router.post(
  "/discord/remind-unlinked",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  discordWebhookController.remindUnlinkedDiscord,
);

// Send reminder email to a specific intern
router.post(
  "/discord/remind/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOK_MANAGE),
  discordWebhookController.remindInternDiscord,
);

export default router;

