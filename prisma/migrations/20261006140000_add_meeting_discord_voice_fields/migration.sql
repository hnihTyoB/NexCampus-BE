-- AlterTable
ALTER TABLE "meetings" ADD COLUMN "discord_channel_id" TEXT,
ADD COLUMN "discord_voice_link" TEXT,
ADD COLUMN "discord_permissions_granted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "discord_permissions_reset_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "meetings_discord_channel_id_idx" ON "meetings"("discord_channel_id");
