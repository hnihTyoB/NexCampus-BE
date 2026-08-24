-- DropIndex
DROP INDEX IF EXISTS "email_notifications_status_attempts_idx";

-- CreateIndex
CREATE INDEX "email_notifications_status_attempts_created_at_idx" ON "email_notifications"("status", "attempts", "created_at");

-- CreateIndex
CREATE INDEX "notification_templates_is_active_created_at_idx" ON "notification_templates"("is_active", "created_at");

-- CreateIndex
CREATE INDEX "notification_templates_is_system_created_at_idx" ON "notification_templates"("is_system", "created_at");
