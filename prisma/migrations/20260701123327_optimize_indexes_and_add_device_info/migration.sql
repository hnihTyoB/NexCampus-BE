-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "applications_approved_by_idx" ON "applications"("approved_by");

-- CreateIndex
CREATE INDEX "daily_reports_intern_id_idx" ON "daily_reports"("intern_id");

-- CreateIndex
CREATE INDEX "intern_profiles_leader_id_idx" ON "intern_profiles"("leader_id");

-- CreateIndex
CREATE INDEX "notification_logs_notification_id_idx" ON "notification_logs"("notification_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "task_assignments_intern_id_idx" ON "task_assignments"("intern_id");

-- CreateIndex
CREATE INDEX "task_assignments_assigned_by_idx" ON "task_assignments"("assigned_by");

-- CreateIndex
CREATE INDEX "task_submissions_assignment_id_idx" ON "task_submissions"("assignment_id");

-- CreateIndex
CREATE INDEX "task_submissions_reviewed_by_idx" ON "task_submissions"("reviewed_by");

-- CreateIndex
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "weekly_evaluations_leader_id_idx" ON "weekly_evaluations"("leader_id");
