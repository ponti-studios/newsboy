ALTER TABLE "labs"."articles" ADD COLUMN "article_text_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD COLUMN "article_text_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD COLUMN "article_text_attempted_at" timestamp;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD COLUMN "article_text_next_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD COLUMN "article_text_error" text;