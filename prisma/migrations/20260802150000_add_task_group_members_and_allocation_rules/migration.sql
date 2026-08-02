ALTER TABLE "task_groups"
ADD COLUMN "max_workload_days" DOUBLE PRECISION NOT NULL DEFAULT 10,
ADD COLUMN "max_active_tasks" INTEGER,
ADD COLUMN "require_all_members" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "task_group_members" (
    "task_group_id" UUID NOT NULL,
    "intern_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_group_members_pkey" PRIMARY KEY ("task_group_id", "intern_id")
);

CREATE INDEX "task_group_members_intern_id_idx" ON "task_group_members"("intern_id");

ALTER TABLE "task_group_members"
ADD CONSTRAINT "task_group_members_task_group_id_fkey"
FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_group_members"
ADD CONSTRAINT "task_group_members_intern_id_fkey"
FOREIGN KEY ("intern_id") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
