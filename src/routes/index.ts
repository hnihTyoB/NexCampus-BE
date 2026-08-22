import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import rbacRoute from '../modules/rbac/rbac.route';
import notificationRoute from '../modules/notification/notification.route';
import maintenanceRoute from '../modules/maintenance/maintenance.route';
import { maintenanceGuard } from '../middlewares/maintenance.middleware';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Maintenance module APIs
router.use('/maintenance', maintenanceRoute);

// Auth APIs (Admin login/refresh is exempt from maintenance lockout)
router.use('/auth', authRoute);

// Protected domain routes guarded by maintenance mode
router.use(maintenanceGuard());

router.use('/users', userRoute);
router.use('/rbac', rbacRoute);
router.use('/notifications', notificationRoute);

export default router;
