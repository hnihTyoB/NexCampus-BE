-- AddColumn: reviewed_at to weekly_evaluations
ALTER TABLE "weekly_evaluations" ADD COLUMN "reviewed_at" TIMESTAMP(3);
