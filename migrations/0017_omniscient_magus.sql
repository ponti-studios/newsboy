ALTER TABLE "labs"."realitea_attempts" RENAME TO "games_attempts";--> statement-breakpoint
ALTER TABLE "labs"."games_attempts" DROP CONSTRAINT "realitea_attempts_games_topic_id_games_topics_id_fk";
--> statement-breakpoint
DROP INDEX "labs"."realitea_attempts_user_games_topic_date_idx";--> statement-breakpoint
DROP INDEX "labs"."realitea_attempts_user_updated_idx";--> statement-breakpoint
ALTER TABLE "labs"."games_attempts" ADD CONSTRAINT "games_attempts_games_topic_id_games_topics_id_fk" FOREIGN KEY ("games_topic_id") REFERENCES "labs"."games_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_attempts_user_games_topic_date_idx" ON "labs"."games_attempts" USING btree ("hominem_user_id","games_topic_id","date_utc");--> statement-breakpoint
CREATE INDEX "games_attempts_user_updated_idx" ON "labs"."games_attempts" USING btree ("hominem_user_id","updated_at");