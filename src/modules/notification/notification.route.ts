import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
  sendNotificationSchema,
  broadcastNotificationSchema,
  listEmailsSchema,
  emailIdParamSchema,
  listNotificationTemplatesSchema,
  templateCodeParamSchema,
  templateIdParamSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  previewNotificationTemplateSchema,
  testSendNotificationTemplateSchema,
} from './notification.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

router.get('/stream', controller.stream);
router.get('/', validate(listNotificationsSchema, 'query'), controller.list);
router.get('/unread-count', controller.unreadCount);

router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), controller.markAsRead);
router.delete('/:id', validate(notificationIdParamSchema, 'params'), controller.delete);

router.post('/send', requirePermission(PERMISSIONS.NOTIFICATION_CREATE), validate(sendNotificationSchema), controller.send);
router.post('/broadcast', requirePermission(PERMISSIONS.NOTIFICATION_CREATE), validate(broadcastNotificationSchema), controller.broadcast);
router.get('/emails', requirePermission(PERMISSIONS.NOTIFICATION_READ), validate(listEmailsSchema, 'query'), controller.listEmails);
router.post('/emails/:id/retry', requirePermission(PERMISSIONS.NOTIFICATION_UPDATE), validate(emailIdParamSchema, 'params'), controller.retryEmail);

router.get('/templates', requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ), validate(listNotificationTemplatesSchema, 'query'), controller.listTemplates);
router.get('/templates/:code', requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ), validate(templateCodeParamSchema, 'params'), controller.getTemplateByCode);
router.post('/templates', requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE), validate(createNotificationTemplateSchema), controller.createTemplate);
router.put(
  '/templates/:id',
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateIdParamSchema, 'params'),
  validate(updateNotificationTemplateSchema),
  controller.updateTemplate,
);
router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateIdParamSchema, 'params'),
  controller.deleteTemplate,
);
router.post(
  '/templates/:code/preview',
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ),
  validate(templateCodeParamSchema, 'params'),
  validate(previewNotificationTemplateSchema),
  controller.previewTemplate,
);
router.post(
  '/templates/:code/test-send',
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateCodeParamSchema, 'params'),
  validate(testSendNotificationTemplateSchema),
  controller.testSendTemplate,
);

export default router;
