CREATE TABLE "labs"."game_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"session_id" text NOT NULL,
	"topic_slug" text NOT NULL,
	"puzzle_date" date NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"clue_count" integer DEFAULT 0 NOT NULL,
	"acquisition_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "game_events_created_at_idx" ON "labs"."game_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_events_session_puzzle_idx" ON "labs"."game_events" USING btree ("session_id","topic_slug","puzzle_date");