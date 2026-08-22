import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import rbacRoute from '../modules/rbac/rbac.route';
import notificationRoute from '../modules/notification/notification.route';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/rbac', rbacRoute);
router.use('/notifications', notificationRoute);

export default router;
