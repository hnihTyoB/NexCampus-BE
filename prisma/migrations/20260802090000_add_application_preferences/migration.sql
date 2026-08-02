-- Keep candidate preferences independent from internal department assignments.
ALTER TABLE "applications"
ADD COLUMN "preferred_department" TEXT,
ADD COLUMN "preferred_position" TEXT;
