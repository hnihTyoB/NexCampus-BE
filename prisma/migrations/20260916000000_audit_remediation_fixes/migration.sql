-- AlterTable
ALTER TABLE "weekly_evaluations" ALTER COLUMN "year" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_assignment_id_attempt_key" ON "task_submissions"("assignment_id", "attempt");

-- CreateIndex
CREATE INDEX "tasks_deadline_idx" ON "tasks"("deadline");

-- CreateIndex
CREATE INDEX "tasks_deleted_at_deadline_idx" ON "tasks"("deleted_at", "deadline");

-- CreateIndex
CREATE INDEX "task_assignments_intern_id_status_idx" ON "task_assignments"("intern_id", "status");
