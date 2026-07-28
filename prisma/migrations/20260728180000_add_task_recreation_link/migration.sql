-- Add a nullable self-reference that links an overdue task to its recreated task.
ALTER TABLE "tasks" ADD COLUMN "recreated_task_id" UUID;

CREATE INDEX "tasks_recreated_task_id_idx"
ON "tasks"("recreated_task_id");

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_recreated_task_id_fkey"
FOREIGN KEY ("recreated_task_id")
REFERENCES "tasks"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
