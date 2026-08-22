import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createUserSchema, findAllUserSchema, updateUserSchema, userIdParamSchema } from './user.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();
const controller = new UserController();

router.get('/', authMiddleware, requirePermission(PERMISSIONS.USER_READ), validate(findAllUserSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.USER_READ), validate(userIdParamSchema, 'params'), controller.findById);
router.post('/', authMiddleware, requirePermission(PERMISSIONS.USER_CREATE), validate(createUserSchema), controller.create);
router.put('/:id', authMiddleware, requirePermission(PERMISSIONS.USER_UPDATE), validate(userIdParamSchema, 'params'), validate(updateUserSchema), controller.update);
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.USER_DELETE), validate(userIdParamSchema, 'params'), controller.softDelete);

export default router;
