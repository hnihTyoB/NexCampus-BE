import { Router } from "express";
import authRoute from "../modules/auth/auth.route";
import userRoute from "../modules/users/user.route";
import applicationRoute from "../modules/applications/application.route";
import internRoute from "../modules/interns/intern.route";
import taskRoute from "../modules/tasks/task.route";
import taskAssignmentRoute from "../modules/task-assignments/task-assignment.route";
import taskSubmissionRoute from "../modules/task-submissions/task-submission.route";
import dailyReportRoute from "../modules/daily-reports/daily-report.route";
import weeklyEvaluationRoute from "../modules/weekly-evaluations/weekly-evaluation.route";
import notificationLogRoute from "../modules/notification-logs/notification-log.route";
import notificationRoute from "../modules/notifications/notification.route";
import notificationSettingRoute from "../modules/notification-settings/notification-setting.route";
import notificationTemplateRoute from "../modules/notification-templates/notification-template.route";
import statsRoute from "../modules/stats/stats.route";
import activityLogRoute from "../modules/activity-logs/activity-log.route";
import regulationRoute from "../modules/regulations/regulation.route";
import pdfExportRoute from "../modules/pdf-export/pdf-export.route";
import departmentRoute from "../modules/departments/department.route";
import leaderRoute from "../modules/leaders/leader.route";
import systemSettingRoute from "../modules/system-settings/system-setting.route";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoute);
router.use("/users", userRoute);
router.use("/applications", applicationRoute);
router.use("/interns", internRoute);
router.use("/tasks", taskRoute);
router.use("/task-assignments", taskAssignmentRoute);
router.use("/task-submissions", taskSubmissionRoute);
router.use("/daily-reports", dailyReportRoute);
router.use("/weekly-evaluations", weeklyEvaluationRoute);
router.use("/notification-logs", notificationLogRoute);
router.use("/notifications", notificationRoute);
router.use("/notification-settings", notificationSettingRoute);
router.use("/notification-templates", notificationTemplateRoute);
router.use("/stats", statsRoute);
router.use("/activity-logs", activityLogRoute);
router.use("/regulations", regulationRoute);
router.use("/pdf-exports", pdfExportRoute);
router.use("/departments", departmentRoute);
router.use("/leaders", leaderRoute);
router.use("/settings", systemSettingRoute);

export default router;
