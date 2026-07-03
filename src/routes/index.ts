import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import applicationRoute from '../modules/applications/application.route';
import internRoute from '../modules/interns/intern.route';
import taskRoute from '../modules/tasks/task.route';
import taskAssignmentRoute from '../modules/task-assignments/task-assignment.route';
import taskSubmissionRoute from '../modules/task-submissions/task-submission.route';
import dailyReportRoute from '../modules/daily-reports/daily-report.route';
import weeklyEvaluationRoute from '../modules/weekly-evaluations/weekly-evaluation.route';
import notificationLogRoute from '../modules/notification-logs/notification-log.route';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/applications', applicationRoute);
router.use('/interns', internRoute);
router.use('/tasks', taskRoute);
router.use('/task-assignments', taskAssignmentRoute);
router.use('/task-submissions', taskSubmissionRoute);
router.use('/daily-reports', dailyReportRoute);
router.use('/weekly-evaluations', weeklyEvaluationRoute);
router.use('/notification-logs', notificationLogRoute);

export default router;
