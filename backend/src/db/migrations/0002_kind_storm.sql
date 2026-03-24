ALTER TYPE "public"."job_status" ADD VALUE 'queued' BEFORE 'pending';--> statement-breakpoint
ALTER TABLE "pipelines" DROP CONSTRAINT "pipelines_username_unique";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "pipelines" DROP COLUMN "username";