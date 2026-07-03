import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { loginSchema, refreshSchema, logoutSchema } from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/login', validate(loginSchema), controller.login);
router.get('/me', authMiddleware, controller.me);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(logoutSchema), controller.logout);

export default router;
