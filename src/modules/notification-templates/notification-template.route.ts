import { Router } from 'express';
import { NotificationTemplateController } from './notification-template.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { updateNotificationTemplateSchema } from './notification-template.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new NotificationTemplateController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.findById);
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(updateNotificationTemplateSchema), controller.update);

export default router;
