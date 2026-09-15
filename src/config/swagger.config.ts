import { SwaggerUiOptions } from "swagger-ui-express";
import { buildOpenApiSpec } from "./openapi/openapi.registry";
import { registerAuthOpenApi } from "../modules/auth/auth.openapi";
import { registerUserOpenApi } from "../modules/users/user.openapi";
import { registerRbacOpenApi } from "../modules/rbac/rbac.openapi";
import { registerNotificationOpenApi } from "../modules/notification/notification.openapi";
import { registerMaintenanceOpenApi } from "../modules/maintenance/maintenance.openapi";
import { registerIntegrationOpenApi } from "../modules/integration/integration.openapi";
import { registerSystemConfigOpenApi } from "../modules/system-config/system-config.openapi";
import { registerCronOpenApi } from "../modules/cron/cron.openapi";
import { registerDepartmentOpenApi } from "../modules/departments/department.openapi";
import { registerLeaderOpenApi } from "../modules/leaders/leader.openapi";
import { registerInternOpenApi } from "../modules/interns/intern.openapi";
import { registerApplicationOpenApi } from "../modules/applications/application.openapi";
import { registerTaskGroupOpenApi } from "../modules/task-groups/task-group.openapi";
import { registerTaskOpenApi } from "../modules/tasks/task.openapi";
import { registerTaskAssignmentOpenApi } from "../modules/task-assignments/task-assignment.openapi";
import { registerTaskSubmissionOpenApi } from "../modules/task-submissions/task-submission.openapi";
import { registerMeetingOpenApi } from "../modules/meetings/meeting.openapi";
import { registerAbsenceOpenApi } from "../modules/absences/absence.openapi";
import { registerDailyReportOpenApi } from "../modules/daily-reports/daily-report.openapi";
import { registerWeeklyEvaluationOpenApi } from "../modules/weekly-evaluations/weekly-evaluation.openapi";
import { registerHealthOpenApi } from "../routes/health.openapi";

// Tự động khởi tạo và đăng ký 100% routes & schemas từ Zod validation schemas
registerAuthOpenApi();
registerUserOpenApi();
registerRbacOpenApi();
registerNotificationOpenApi();
registerMaintenanceOpenApi();
registerIntegrationOpenApi();
registerSystemConfigOpenApi();
registerCronOpenApi();
registerDepartmentOpenApi();
registerLeaderOpenApi();
registerInternOpenApi();
registerApplicationOpenApi();
registerTaskGroupOpenApi();
registerTaskOpenApi();
registerTaskAssignmentOpenApi();
registerTaskSubmissionOpenApi();
registerMeetingOpenApi();
registerAbsenceOpenApi();
registerDailyReportOpenApi();
registerWeeklyEvaluationOpenApi();
registerHealthOpenApi();


export const swaggerOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link img { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: 'Template API'; color: white; font-size: 1.2rem; font-weight: bold; }
  `,
  customSiteTitle: "API Documentation",
};

export const swaggerSpec: Record<string, any> = buildOpenApiSpec();
