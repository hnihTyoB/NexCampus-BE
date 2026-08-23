-- AlterTable
ALTER TABLE "maintenance_configs" ADD COLUMN "bypass_ips" JSONB NOT NULL DEFAULT '[]';
