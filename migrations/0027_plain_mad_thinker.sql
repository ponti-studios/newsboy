ALTER TABLE "labs"."articles" DROP CONSTRAINT "articles_url_unique";--> statement-breakpoint
ALTER TABLE "labs"."games_topics" ADD COLUMN "activation_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_games_topic_url_idx" ON "labs"."articles" USING btree ("games_topic_id","url");