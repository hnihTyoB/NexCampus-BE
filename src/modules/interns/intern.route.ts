import { Router } from 'express';
import { InternController } from './intern.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  findAllInternSchema,
  createInternSchema,
  updateInternSchema,
} from './intern.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new InternController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(findAllInternSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(createInternSchema), controller.create);
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(updateInternSchema), controller.update);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN), controller.delete);

export default router;
