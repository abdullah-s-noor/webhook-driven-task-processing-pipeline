ALTER TABLE "pipelines" DROP CONSTRAINT IF EXISTS "pipelines_username_unique";
--> statement-breakpoint
ALTER TABLE "pipelines" DROP COLUMN IF EXISTS "username";
