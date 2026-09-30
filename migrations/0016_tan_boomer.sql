CREATE TABLE "labs"."realitea_admin_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"hominem_user_id" text NOT NULL,
	"email" text,
	"kind" text NOT NULL,
	"games_topic_id" integer NOT NULL,
	"date_utc" date,
	"dry_run" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs"."realitea_generation_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"normalized_answer" text NOT NULL,
	"valid" boolean NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hand_edited" boolean DEFAULT false NOT NULL,
	"article_id" integer
);
--> statement-breakpoint
CREATE TABLE "labs"."realitea_generation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"games_topic_id" integer NOT NULL,
	"date_key" date NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"source_mode" text NOT NULL,
	"feed_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"article_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feed_url" text,
	"prompt_source" text NOT NULL,
	"prompt_path" text,
	"prompt_text" text NOT NULL,
	"model" text NOT NULL,
	"excluded_answer_count" integer DEFAULT 0 NOT NULL,
	"feed_item_count" integer DEFAULT 0 NOT NULL,
	"selected_index" integer,
	"feed_error" text,
	"llm_error" text,
	"compare_group_id" text,
	"publishable" boolean DEFAULT false NOT NULL,
	"created_by_hominem_user_id" text NOT NULL,
	"created_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "labs"."realitea_puzzle_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"games_topic_id" integer NOT NULL,
	"date_utc" date NOT NULL,
	"puzzle_id" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"attempts_snapshot" jsonb NOT NULL,
	"replaced_by_hominem_user_id" text NOT NULL,
	"replaced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD COLUMN "prompt_path" text;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD COLUMN "generation_run_id" integer;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "labs"."realitea_admin_actions" ADD CONSTRAINT "realitea_admin_actions_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_candidates" ADD CONSTRAINT "realitea_generation_candidates_run_id_realitea_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "labs"."realitea_generation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_candidates" ADD CONSTRAINT "realitea_generation_candidates_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "labs"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" ADD CONSTRAINT "realitea_generation_runs_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_puzzle_revisions" ADD CONSTRAINT "realitea_puzzle_revisions_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_puzzle_revisions" ADD CONSTRAINT "realitea_puzzle_revisions_puzzle_id_daily_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "labs"."daily_puzzles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "realitea_admin_actions_at_idx" ON "labs"."realitea_admin_actions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "realitea_admin_actions_kind_at_idx" ON "labs"."realitea_admin_actions" USING btree ("kind","at");--> statement-breakpoint
CREATE INDEX "realitea_admin_actions_date_idx" ON "labs"."realitea_admin_actions" USING btree ("date_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "realitea_generation_candidates_run_ordinal_idx" ON "labs"."realitea_generation_candidates" USING btree ("run_id","ordinal");--> statement-breakpoint
CREATE INDEX "realitea_generation_runs_topic_created_idx" ON "labs"."realitea_generation_runs" USING btree ("games_topic_id","created_at");--> statement-breakpoint
CREATE INDEX "realitea_generation_runs_date_created_idx" ON "labs"."realitea_generation_runs" USING btree ("date_key","created_at");--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD CONSTRAINT "daily_puzzles_generation_run_id_realitea_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "labs"."realitea_generation_runs"("id") ON DELETE set null ON UPDATE no action;