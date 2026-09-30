ALTER TABLE "labs"."rhobh_daily_puzzles" RENAME TO "daily_puzzles";--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" DROP CONSTRAINT "normalized_answer_length";--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" DROP CONSTRAINT "rhobh_daily_puzzles_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" DROP CONSTRAINT "rhobh_daily_puzzles_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD CONSTRAINT "daily_puzzles_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "labs"."games"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD CONSTRAINT "daily_puzzles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "labs"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD CONSTRAINT "normalized_answer_length" CHECK (length("labs"."daily_puzzles"."normalized_answer") = 5);