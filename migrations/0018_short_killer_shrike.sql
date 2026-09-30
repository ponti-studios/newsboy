ALTER TABLE "labs"."daily_puzzles" RENAME TO "games_puzzles";--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" DROP CONSTRAINT "normalized_answer_length";--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" DROP CONSTRAINT "daily_puzzles_games_topic_id_games_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" DROP CONSTRAINT "daily_puzzles_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" DROP CONSTRAINT "daily_puzzles_generation_run_id_realitea_generation_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."realitea_puzzle_revisions" DROP CONSTRAINT "realitea_puzzle_revisions_puzzle_id_daily_puzzles_id_fk";
--> statement-breakpoint
DROP INDEX "labs"."daily_puzzles_games_topic_date_idx";--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" ADD CONSTRAINT "games_puzzles_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" ADD CONSTRAINT "games_puzzles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "labs"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" ADD CONSTRAINT "games_puzzles_generation_run_id_realitea_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "labs"."realitea_generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_puzzle_revisions" ADD CONSTRAINT "realitea_puzzle_revisions_puzzle_id_games_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "labs"."games_puzzles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_puzzles_games_topic_date_idx" ON "labs"."games_puzzles" USING btree ("games_topic_id","date_utc");--> statement-breakpoint
ALTER TABLE "labs"."games_puzzles" ADD CONSTRAINT "normalized_answer_length" CHECK (length("labs"."games_puzzles"."normalized_answer") = 5);