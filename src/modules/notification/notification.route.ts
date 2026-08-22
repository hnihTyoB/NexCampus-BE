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
} from './notification.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

router.get('/', validate(listNotificationsSchema, 'query'), controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), controller.markAsRead);
router.delete('/:id', validate(notificationIdParamSchema, 'params'), controller.delete);

router.post('/send', requirePermission(PERMISSIONS.NOTIFICATION_CREATE), validate(sendNotificationSchema), controller.send);
router.post('/broadcast', requirePermission(PERMISSIONS.NOTIFICATION_CREATE), validate(broadcastNotificationSchema), controller.broadcast);
router.get('/emails', requirePermission(PERMISSIONS.NOTIFICATION_READ), validate(listEmailsSchema, 'query'), controller.listEmails);
router.post('/emails/:id/retry', requirePermission(PERMISSIONS.NOTIFICATION_UPDATE), validate(emailIdParamSchema, 'params'), controller.retryEmail);

export default router;
