import { Router } from "express";
import authRoute from "../modules/auth/auth.route";
import userRoute from "../modules/users/user.route";
import rbacRoute from "../modules/rbac/rbac.route";
import notificationRoute from "../modules/notification/notification.route";
import maintenanceRoute from "../modules/maintenance/maintenance.route";
import integrationRoute from "../modules/integration/integration.route";
import systemConfigRoute from "../modules/system-config/system-config.route";
import cronRoute from "../modules/cron/cron.route";
import departmentRoute from "../modules/departments/department.route";
import leaderRoute from "../modules/leaders/leader.route";
import internRoute from "../modules/interns/intern.route";
import applicationRoute from "../modules/applications/application.route";
import taskGroupRoute from "../modules/task-groups/task-group.route";
import taskRoute from "../modules/tasks/task.route";
import taskAssignmentRoute from "../modules/task-assignments/task-assignment.route";
import healthRoute from "./health.route";
import { maintenanceGuard } from "../middlewares/maintenance.middleware";

const router = Router();

// Observability & Diagnostics
router.use("/health", healthRoute);

// Maintenance Mode Controls & Public Status
router.use("/maintenance", maintenanceRoute);

// Maintenance Enforcement Guard for all Business APIs below
router.use(maintenanceGuard());

// System Configuration & Feature Flags Endpoints (exempted public paths handled inside guard)
router.use("/system", systemConfigRoute);
router.use("/auth", authRoute);
router.use("/users", userRoute);
router.use("/rbac", rbacRoute);
router.use("/notifications", notificationRoute);
router.use("/integrations", integrationRoute);
router.use("/integration", integrationRoute);
router.use("/cron", cronRoute);
router.use("/departments", departmentRoute);
router.use("/leaders", leaderRoute);
router.use("/interns", internRoute);
router.use("/applications", applicationRoute);
router.use("/task-groups", taskGroupRoute);
router.use("/tasks", taskRoute);
router.use("/task-assignments", taskAssignmentRoute);

export default router;
