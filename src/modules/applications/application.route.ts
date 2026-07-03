import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createApplicationSchema,
  findAllApplicationSchema,
  reviewApplicationSchema,
} from './application.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new ApplicationController();

router.post('/', validate(createApplicationSchema), controller.create);
router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(findAllApplicationSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.findById);
router.patch('/:id/review', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(reviewApplicationSchema), controller.review);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN), controller.delete);

export default router;
