ALTER TABLE "labs"."games" RENAME TO "games_topics";--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD COLUMN "feed_url" text;--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD COLUMN "feed_kind" text DEFAULT 'rss';--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD COLUMN "feed_label" text;--> statement-breakpoint
UPDATE "labs"."games_topics" AS gt
SET "feed_url" = f."url", "feed_kind" = f."kind", "feed_label" = f."label"
FROM "labs"."feed_games" AS fg
INNER JOIN "labs"."feeds" AS f ON f."id" = fg."feed_id"
WHERE fg."game_id" = gt."id";--> statement-breakpoint
ALTER TABLE "labs"."articles" RENAME COLUMN "feed_id" TO "games_topic_id";--> statement-breakpoint
ALTER TABLE "labs"."articles" DROP CONSTRAINT "articles_feed_id_feeds_id_fk";--> statement-breakpoint
UPDATE "labs"."articles" AS a
SET "games_topic_id" = fg."game_id"
FROM "labs"."feed_games" AS fg
WHERE fg."feed_id" = a."games_topic_id";--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" RENAME COLUMN "game_id" TO "games_topic_id";--> statement-breakpoint
ALTER TABLE "labs"."realitea_attempts" RENAME COLUMN "game_id" TO "games_topic_id";--> statement-breakpoint
ALTER TABLE "labs"."feed_games" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "labs"."feeds" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "labs"."feed_games" CASCADE;--> statement-breakpoint
DROP TABLE "labs"."feeds" CASCADE;--> statement-breakpoint
ALTER TABLE "labs"."games_topics" DROP CONSTRAINT "games_slug_unique";--> statement-breakpoint
DROP INDEX "labs"."daily_puzzles_game_date_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_attempts_user_game_date_idx";--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ALTER COLUMN "feed_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ALTER COLUMN "feed_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ALTER COLUMN "feed_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD CONSTRAINT "articles_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."daily_puzzles" ADD CONSTRAINT "daily_puzzles_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."realitea_attempts" ADD CONSTRAINT "realitea_attempts_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_puzzles_games_topic_date_idx" ON "labs"."daily_puzzles" USING btree ("games_topic_id","date_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "realitea_attempts_user_games_topic_date_idx" ON "labs"."realitea_attempts" USING btree ("hominem_user_id","games_topic_id","date_utc");--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD CONSTRAINT "games_topics_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD CONSTRAINT "games_topics_feed_url_unique" UNIQUE("feed_url");
