import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import rbacRoute from '../modules/rbac/rbac.route';
import notificationRoute from '../modules/notification/notification.route';
import maintenanceRoute from '../modules/maintenance/maintenance.route';
import integrationRoute from '../modules/integration/integration.route';
import systemConfigRoute from '../modules/system-config/system-config.route';
import cronRoute from '../modules/cron/cron.route';
import healthRoute from './health.route';
import { maintenanceGuard } from '../middlewares/maintenance.middleware';

const router = Router();

// Observability & Diagnostics
router.use('/health', healthRoute);

// Maintenance Mode Controls & Public Status
router.use('/maintenance', maintenanceRoute);

// System Configuration & Feature Flags Public Endpoints
router.use('/system', systemConfigRoute);

// Maintenance Enforcement Guard for all Business APIs below
router.use(maintenanceGuard());

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/rbac', rbacRoute);
router.use('/notifications', notificationRoute);
router.use('/integrations', integrationRoute);
router.use('/cron', cronRoute);

export default router;


