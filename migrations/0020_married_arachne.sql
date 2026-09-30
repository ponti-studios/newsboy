ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "requested_max_tokens" integer;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "reasoning_effort" text;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "reasoning_tokens" integer;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "total_tokens" integer;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD COLUMN "cost_usd" double precision;