ALTER TABLE "labs"."realitea_generation_runs" ALTER COLUMN "games_topic_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "trigger" text;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "environment" text;