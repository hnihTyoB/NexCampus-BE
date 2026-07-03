import { Router } from 'express';
import { TaskAssignmentController } from './task-assignment.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  findAllAssignmentSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from './task-assignment.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new TaskAssignmentController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), validate(findAllAssignmentSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(createAssignmentSchema), controller.create);
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), validate(updateAssignmentSchema), controller.update);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER), controller.delete);

export default router;
