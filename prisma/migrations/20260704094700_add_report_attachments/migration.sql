-- CreateTable
CREATE TABLE "report_attachments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
