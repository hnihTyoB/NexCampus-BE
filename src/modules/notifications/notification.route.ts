import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  findAllNotificationSchema,
  createNotificationSchema,
} from './notification.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new NotificationController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), validate(findAllNotificationSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(createNotificationSchema), controller.create);
router.patch('/:id/read', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.markAsRead);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.delete);

export default router;
