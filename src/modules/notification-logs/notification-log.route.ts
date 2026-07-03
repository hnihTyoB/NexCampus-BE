import { Router } from 'express';
import { NotificationLogController } from './notification-log.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  findAllNotificationLogSchema,
  createNotificationLogSchema,
  updateNotificationLogSchema,
} from './notification-log.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new NotificationLogController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), validate(findAllNotificationLogSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(createNotificationLogSchema), controller.create);
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(updateNotificationLogSchema), controller.update);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.delete);

export default router;
