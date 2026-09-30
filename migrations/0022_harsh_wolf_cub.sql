ALTER TABLE "labs"."realitea_admin_actions" RENAME TO "what_admin_actions";--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_candidates" RENAME TO "what_generation_candidates";--> statement-breakpoint
ALTER TABLE "labs"."realitea_generation_runs" RENAME TO "what_generation_runs";--> statement-breakpoint
ALTER TABLE "labs"."realitea_puzzle_revisions" RENAME TO "what_puzzle_revisions";--> statement-breakpoint
ALTER TABLE "labs"."what_admin_actions" DROP CONSTRAINT "realitea_admin_actions_games_topic_id_games_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" DROP CONSTRAINT "games_puzzles_generation_run_id_realitea_generation_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."what_generation_candidates" DROP CONSTRAINT "realitea_generation_candidates_run_id_realitea_generation_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."what_generation_candidates" DROP CONSTRAINT "realitea_generation_candidates_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."what_generation_runs" DROP CONSTRAINT "realitea_generation_runs_games_topic_id_games_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."what_puzzle_revisions" DROP CONSTRAINT "realitea_puzzle_revisions_games_topic_id_games_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."what_puzzle_revisions" DROP CONSTRAINT "realitea_puzzle_revisions_puzzle_id_games_puzzles_id_fk";
--> statement-breakpoint
DROP INDEX "labs"."realitea_admin_actions_at_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_admin_actions_kind_at_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_admin_actions_date_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_generation_candidates_run_ordinal_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_generation_runs_topic_created_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_generation_runs_date_created_idx";--> statement-breakpoint
ALTER TABLE "labs"."what_admin_actions" ADD CONSTRAINT "what_admin_actions_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" ADD CONSTRAINT "games_puzzles_generation_run_id_what_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "labs"."what_generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."what_generation_candidates" ADD CONSTRAINT "what_generation_candidates_run_id_what_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "labs"."what_generation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."what_generation_candidates" ADD CONSTRAINT "what_generation_candidates_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "labs"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."what_generation_runs" ADD CONSTRAINT "what_generation_runs_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."what_puzzle_revisions" ADD CONSTRAINT "what_puzzle_revisions_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."what_puzzle_revisions" ADD CONSTRAINT "what_puzzle_revisions_puzzle_id_games_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "labs"."games_puzzles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "what_admin_actions_at_idx" ON "labs"."what_admin_actions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "what_admin_actions_kind_at_idx" ON "labs"."what_admin_actions" USING btree ("kind","at");--> statement-breakpoint
CREATE INDEX "what_admin_actions_date_idx" ON "labs"."what_admin_actions" USING btree ("date_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "what_generation_candidates_run_ordinal_idx" ON "labs"."what_generation_candidates" USING btree ("run_id","ordinal");--> statement-breakpoint
CREATE INDEX "what_generation_runs_topic_created_idx" ON "labs"."what_generation_runs" USING btree ("games_topic_id","created_at");--> statement-breakpoint
CREATE INDEX "what_generation_runs_date_created_idx" ON "labs"."what_generation_runs" USING btree ("date_key","created_at");