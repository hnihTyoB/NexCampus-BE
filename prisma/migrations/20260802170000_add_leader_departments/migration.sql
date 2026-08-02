-- CreateTable
CREATE TABLE "leader_departments" (
    "leader_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_departments_pkey" PRIMARY KEY ("leader_id", "department_id")
);

-- Preserve every existing leader assignment before removing the legacy column.
INSERT INTO "leader_departments" ("leader_id", "department_id")
SELECT "id", "department_id"
FROM "leaders"
WHERE "department_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "leaders" DROP CONSTRAINT "leaders_department_id_fkey";

-- DropIndex
DROP INDEX "leaders_department_id_idx";

-- AlterTable
ALTER TABLE "leaders" DROP COLUMN "department_id";

-- CreateIndex
CREATE INDEX "leader_departments_department_id_idx" ON "leader_departments"("department_id");

-- AddForeignKey
ALTER TABLE "leader_departments" ADD CONSTRAINT "leader_departments_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "leaders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_departments" ADD CONSTRAINT "leader_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
