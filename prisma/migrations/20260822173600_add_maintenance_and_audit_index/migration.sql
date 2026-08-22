-- CreateTable
CREATE TABLE "maintenance_configs" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'DEFAULT',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "title" TEXT NOT NULL DEFAULT 'Hệ thống đang bảo trì',
    "message" TEXT NOT NULL DEFAULT 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.',
    "start_at" TIMESTAMP(3),
    "estimated_end_at" TIMESTAMP(3),
    "bypass_permissions" JSONB NOT NULL DEFAULT '["MAINTENANCE_MANAGE", "MAINTENANCE_BYPASS"]',
    "bypass_roles" JSONB NOT NULL DEFAULT '["ADMIN"]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_configs_key_key" ON "maintenance_configs"("key");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
