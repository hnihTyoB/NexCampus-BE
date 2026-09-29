-- CreateEnum
CREATE TYPE "DiscordWebhookScope" AS ENUM ('GLOBAL', 'DEPARTMENT', 'TASK_GROUP');

-- CreateEnum
CREATE TYPE "DiscordWebhookPurpose" AS ENUM ('DAILY_STANDUP', 'TASK_BOARD', 'MEETING_ROOM', 'LEADERBOARD', 'LEADER_ALERTS');

-- CreateEnum
CREATE TYPE "DiscordPingStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "discord_webhook_configs" (
    "id" UUID NOT NULL,
    "scope" "DiscordWebhookScope" NOT NULL DEFAULT 'GLOBAL',
    "department_id" UUID,
    "task_group_id" UUID,
    "purpose" "DiscordWebhookPurpose" NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "discord_role_id" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_ping_at" TIMESTAMP(3),
    "last_status" "DiscordPingStatus",
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_webhook_configs_scope_idx" ON "discord_webhook_configs"("scope");

-- CreateIndex
CREATE INDEX "discord_webhook_configs_department_id_idx" ON "discord_webhook_configs"("department_id");

-- CreateIndex
CREATE INDEX "discord_webhook_configs_task_group_id_idx" ON "discord_webhook_configs"("task_group_id");

-- CreateIndex
CREATE INDEX "discord_webhook_configs_purpose_idx" ON "discord_webhook_configs"("purpose");

-- CreateIndex
CREATE INDEX "discord_webhook_configs_is_enabled_idx" ON "discord_webhook_configs"("is_enabled");

-- AddForeignKey
ALTER TABLE "discord_webhook_configs" ADD CONSTRAINT "discord_webhook_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_webhook_configs" ADD CONSTRAINT "discord_webhook_configs_task_group_id_fkey" FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
