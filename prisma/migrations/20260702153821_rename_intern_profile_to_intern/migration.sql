/*
  Warnings:

  - You are about to drop the `intern_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "daily_reports" DROP CONSTRAINT "daily_reports_intern_id_fkey";

-- DropForeignKey
ALTER TABLE "intern_profiles" DROP CONSTRAINT "intern_profiles_leader_id_fkey";

-- DropForeignKey
ALTER TABLE "intern_profiles" DROP CONSTRAINT "intern_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "task_assignments" DROP CONSTRAINT "task_assignments_intern_id_fkey";

-- DropForeignKey
ALTER TABLE "weekly_evaluations" DROP CONSTRAINT "weekly_evaluations_intern_id_fkey";

-- DropTable
DROP TABLE "intern_profiles";

-- CreateTable
CREATE TABLE "interns" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leader_id" UUID,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "discord_username" TEXT,
    "discord_role_granted" BOOLEAN NOT NULL DEFAULT false,
    "status" "InternStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interns_user_id_key" ON "interns"("user_id");

-- CreateIndex
CREATE INDEX "interns_leader_id_idx" ON "interns"("leader_id");

-- AddForeignKey
ALTER TABLE "interns" ADD CONSTRAINT "interns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interns" ADD CONSTRAINT "interns_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_intern_id_fkey" FOREIGN KEY ("intern_id") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_intern_id_fkey" FOREIGN KEY ("intern_id") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_evaluations" ADD CONSTRAINT "weekly_evaluations_intern_id_fkey" FOREIGN KEY ("intern_id") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
