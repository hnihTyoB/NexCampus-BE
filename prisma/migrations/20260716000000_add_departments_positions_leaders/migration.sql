/*
  Warnings:

  - You are about to drop the column `department` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `interns` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `interns` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingVisibility" AS ENUM ('PRIVATE', 'TEAM');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('HOST', 'ORGANIZER', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('UNKNOWN', 'ATTENDED', 'ABSENT');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'PENDING_APPROVAL';

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_task_group_id_fkey";

-- DropIndex
DROP INDEX "task_groups_name_key";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "department",
DROP COLUMN "position",
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "position_id" UUID;

-- AlterTable
ALTER TABLE "interns" DROP COLUMN "department",
DROP COLUMN "position",
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "position_id" UUID;

-- AlterTable
ALTER TABLE "notification_templates" ADD COLUMN     "email_content_template" TEXT,
ADD COLUMN     "email_subject_template" TEXT;

-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN     "support_id" UUID,
ALTER COLUMN "intern_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "task_groups" ADD COLUMN     "department_id" UUID;

-- AlterTable
ALTER TABLE "weekly_evaluations" ADD COLUMN     "ai_ratings" JSONB,
ADD COLUMN     "ratings" JSONB;

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "department_id" UUID,
    "position" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_histories" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "application_attachments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "location" TEXT,
    "meeting_type" "MeetingType" NOT NULL,
    "meeting_link" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "MeetingVisibility" NOT NULL DEFAULT 'TEAM',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "participant_role" "ParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "invitation_status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "response_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absence_requests" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaders_user_id_key" ON "leaders"("user_id");

-- CreateIndex
CREATE INDEX "leaders_department_id_idx" ON "leaders"("department_id");

-- CreateIndex
CREATE INDEX "export_histories_created_by_id_idx" ON "export_histories"("created_by_id");

-- CreateIndex
CREATE INDEX "export_histories_entity_id_idx" ON "export_histories"("entity_id");

-- CreateIndex
CREATE INDEX "application_attachments_application_id_idx" ON "application_attachments"("application_id");

-- CreateIndex
CREATE INDEX "meetings_created_by_idx" ON "meetings"("created_by");

-- CreateIndex
CREATE INDEX "meetings_host_id_idx" ON "meetings"("host_id");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE INDEX "meetings_start_time_idx" ON "meetings"("start_time");

-- CreateIndex
CREATE INDEX "meetings_start_time_end_time_idx" ON "meetings"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "meeting_participants_user_id_idx" ON "meeting_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participants_meeting_id_user_id_key" ON "meeting_participants"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "absence_requests_participant_id_idx" ON "absence_requests"("participant_id");

-- CreateIndex
CREATE INDEX "absence_requests_status_idx" ON "absence_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "absence_requests_meeting_id_participant_id_key" ON "absence_requests"("meeting_id", "participant_id");

-- CreateIndex
CREATE INDEX "applications_department_id_idx" ON "applications"("department_id");

-- CreateIndex
CREATE INDEX "applications_position_id_idx" ON "applications"("position_id");

-- CreateIndex
CREATE INDEX "interns_department_id_idx" ON "interns"("department_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "task_assignments_support_id_idx" ON "task_assignments"("support_id");

-- CreateIndex
CREATE INDEX "task_groups_department_id_idx" ON "task_groups"("department_id");



-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaders" ADD CONSTRAINT "leaders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaders" ADD CONSTRAINT "leaders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interns" ADD CONSTRAINT "interns_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interns" ADD CONSTRAINT "interns_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_group_id_fkey" FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_support_id_fkey" FOREIGN KEY ("support_id") REFERENCES "interns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_histories" ADD CONSTRAINT "export_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "meeting_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "task_groups_name_department_id_key" ON "task_groups"("name", "department_id");
