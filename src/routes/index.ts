import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import rbacRoute from '../modules/rbac/rbac.route';
import notificationRoute from '../modules/notification/notification.route';
import maintenanceRoute from '../modules/maintenance/maintenance.route';
import integrationRoute from '../modules/integration/integration.route';
import { maintenanceGuard } from '../middlewares/maintenance.middleware';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/maintenance', maintenanceRoute);

router.use(maintenanceGuard());

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/rbac', rbacRoute);
router.use('/notifications', notificationRoute);
router.use('/integrations', integrationRoute);

export default router;
