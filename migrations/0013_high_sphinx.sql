CREATE TABLE "labs"."realitea_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"hominem_user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"date_utc" date NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guessed_at" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "labs"."realitea_attempts" ADD CONSTRAINT "realitea_attempts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "labs"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "realitea_attempts_user_game_date_idx" ON "labs"."realitea_attempts" USING btree ("hominem_user_id","game_id","date_utc");--> statement-breakpoint
CREATE INDEX "realitea_attempts_user_updated_idx" ON "labs"."realitea_attempts" USING btree ("hominem_user_id","updated_at");