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
import taskSubmissionRoute from "../modules/task-submissions/task-submission.route";
import meetingRoute from "../modules/meetings/meeting.route";
import absenceRoute from "../modules/absences/absence.route";
import dailyReportRoute from "../modules/daily-reports/daily-report.route";
import weeklyEvaluationRoute from "../modules/weekly-evaluations/weekly-evaluation.route";
import notificationSettingRoute from "../modules/notification-settings/notification-setting.route";
import notificationTemplateRoute from "../modules/notification/notification-template.route";
import activityLogRoute from "../modules/activity-logs/activity-log.route";
import statsRoute from "../modules/stats/stats.route";
import pdfExportRoute from "../modules/pdf-export/pdf-export.route";
import systemSettingRoute from "../modules/system-settings/system-setting.route";
import regulationRoute from "../modules/regulations/regulation.route";
import healthRoute from "./health.route";
import { maintenanceGuard } from "../middlewares/maintenance.middleware";

const router = Router();

// Observability & Diagnostics
router.use("/health", healthRoute);

// Maintenance Mode Controls & Public Status
router.use("/maintenance", maintenanceRoute);


// Maintenance Enforcement Guard for all Business APIs below
router.use(maintenanceGuard());

// Core Module Routes
router.use("/auth", authRoute);
router.use("/users", userRoute);
router.use("/rbac", rbacRoute);
router.use("/system", systemConfigRoute);
router.use("/system-config", systemConfigRoute);
router.use("/activity-logs", activityLogRoute);

// Organization & Recruitment Routes
router.use("/departments", departmentRoute);
router.use("/leaders", leaderRoute);
router.use("/interns", internRoute);
router.use("/applications", applicationRoute);
router.use("/regulations", regulationRoute);

// Work & Task Management Routes
router.use("/task-groups", taskGroupRoute);
router.use("/tasks", taskRoute);
router.use("/task-assignments", taskAssignmentRoute);
router.use("/task-submissions", taskSubmissionRoute);

// Progress, Evaluation & Collaboration Routes
router.use("/daily-reports", dailyReportRoute);
router.use("/weekly-evaluations", weeklyEvaluationRoute);
router.use("/meetings", meetingRoute);
router.use("/absences", absenceRoute);

// Auxiliary, Communication & Analytics Routes
router.use("/notifications", notificationRoute);
router.use("/notification-settings", notificationSettingRoute);
router.use("/notification-templates", notificationTemplateRoute);
router.use("/stats", statsRoute);
router.use("/pdf-export", pdfExportRoute);
router.use("/pdf-exports", pdfExportRoute); // Legacy NexCampus-BE compatibility
router.use("/system-settings", systemSettingRoute);
router.use("/settings", systemSettingRoute); // Legacy NexCampus-BE compatibility

// Background & Integration Utilities
router.use("/integrations", integrationRoute);
router.use("/integration", integrationRoute);
router.use("/cron", cronRoute);

export default router;

