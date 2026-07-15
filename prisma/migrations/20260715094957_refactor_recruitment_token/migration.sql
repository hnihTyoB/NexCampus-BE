/*
  Warnings:

  - A unique constraint covering the columns `[task_group_id,code]` on the table `tasks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reset_password_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ApplicationInviteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "regulation_id" UUID;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "acceptance_criteria" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "est_days" DOUBLE PRECISION,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "task_group_id" UUID,
ADD COLUMN     "task_notes" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT;

-- AlterTable
ALTER TABLE "weekly_evaluations" ADD COLUMN     "ai_attitude" DOUBLE PRECISION,
ADD COLUMN     "ai_coding" DOUBLE PRECISION,
ADD COLUMN     "ai_comment" TEXT,
ADD COLUMN     "ai_communication" DOUBLE PRECISION,
ADD COLUMN     "ai_generated_at" TIMESTAMP(3),
ADD COLUMN     "ai_learning" DOUBLE PRECISION,
ADD COLUMN     "leader_edited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "task_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title_template" TEXT NOT NULL,
    "content_template" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" UUID,
    "target_type" TEXT,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_invites" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ApplicationInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "applicationId" UUID,
    "createdBy" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulations" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TaskDependencies" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "task_groups_name_key" ON "task_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_key" ON "notification_templates"("type");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_invites_token_key" ON "application_invites"("token");

-- CreateIndex
CREATE INDEX "application_invites_applicationId_idx" ON "application_invites"("applicationId");

-- CreateIndex
CREATE INDEX "application_invites_createdBy_idx" ON "application_invites"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "_TaskDependencies_AB_unique" ON "_TaskDependencies"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskDependencies_B_index" ON "_TaskDependencies"("B");

-- CreateIndex
CREATE INDEX "applications_regulation_id_idx" ON "applications"("regulation_id");

-- CreateIndex
CREATE INDEX "tasks_task_group_id_idx" ON "tasks"("task_group_id");

-- CreateIndex
CREATE INDEX "tasks_phase_idx" ON "tasks"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_task_group_id_code_key" ON "tasks"("task_group_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_password_token_key" ON "users"("reset_password_token");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_regulation_id_fkey" FOREIGN KEY ("regulation_id") REFERENCES "regulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_group_id_fkey" FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_invites" ADD CONSTRAINT "application_invites_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_invites" ADD CONSTRAINT "application_invites_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependencies" ADD CONSTRAINT "_TaskDependencies_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDependencies" ADD CONSTRAINT "_TaskDependencies_B_fkey" FOREIGN KEY ("B") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
