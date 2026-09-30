CREATE TABLE "labs"."games" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"system_prompt_path" text NOT NULL,
	"answer_length" integer DEFAULT 5 NOT NULL,
	"repeat_window_days" integer DEFAULT 90 NOT NULL,
	"article_expiry_days" integer DEFAULT 45 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "labs"."feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'rss' NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "labs"."feed_games" (
	"feed_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	CONSTRAINT "feed_games_feed_id_game_id_pk" PRIMARY KEY("feed_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "labs"."articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"published_at" timestamp,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_count" integer DEFAULT 0 NOT NULL,
	"rejection_reason" text,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ADD COLUMN "game_id" integer;--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ADD COLUMN "article_id" integer;--> statement-breakpoint
ALTER TABLE "labs"."feed_games" ADD CONSTRAINT "feed_games_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "labs"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."feed_games" ADD CONSTRAINT "feed_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "labs"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "labs"."feeds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "labs"."articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "labs"."articles" USING btree ("published_at");--> statement-breakpoint
-- Backfill: seed the rhobh game + its existing feed, then derive one article
-- per historical puzzle from that puzzle's stored realityblurb.com source.
-- If two puzzle rows previously shared the same source url (the exact bug
-- this migration fixes going forward), they now correctly point at the same
-- backfilled article row instead of duplicating it.
--
-- Unlinked puzzles (no realityblurb.com source) and duplicate dates for the
-- same day are deleted before NOT NULL / unique constraints — the new model
-- is exactly one puzzle per (game, date).
DO $$
DECLARE
  v_game_id integer;
  v_feed_id integer;
BEGIN
  INSERT INTO "labs"."games" ("slug", "name", "system_prompt_path", "answer_length", "repeat_window_days", "article_expiry_days")
  VALUES ('rhobh', 'Real Housewives of Beverly Hills', 'app/lib/prompts/realitea-generation.md', 5, 90, 45)
  RETURNING "id" INTO v_game_id;

  INSERT INTO "labs"."feeds" ("url", "kind", "label")
  VALUES ('https://realityblurb.com/feed', 'rss', 'Reality Blurb')
  RETURNING "id" INTO v_feed_id;

  INSERT INTO "labs"."feed_games" ("feed_id", "game_id")
  VALUES (v_feed_id, v_game_id);

  INSERT INTO "labs"."articles" ("feed_id", "url", "title", "published_at", "fetched_at", "status")
  SELECT DISTINCT ON (src ->> 'url')
    v_feed_id,
    src ->> 'url',
    COALESCE(NULLIF(trim(src ->> 'title'), ''), 'Untitled'),
    CASE
      WHEN NULLIF(trim(src ->> 'publishedAt'), '') IS NULL THEN NULL
      ELSE (src ->> 'publishedAt')::timestamp
    END,
    p."created_at",
    'used'
  FROM "labs"."rhobh_daily_puzzles" p,
       LATERAL jsonb_array_elements(p."sources") AS src
  WHERE src ->> 'url' ILIKE '%realityblurb.com%'
    AND NULLIF(trim(src ->> 'url'), '') IS NOT NULL
  ORDER BY src ->> 'url', p."created_at"
  ON CONFLICT ("url") DO NOTHING;

  -- Postgres doesn't allow a LATERAL item in an UPDATE's FROM list to
  -- reference the UPDATE target row itself, so pre-compute the
  -- puzzle -> article match as a subquery and join on that instead.
  UPDATE "labs"."rhobh_daily_puzzles" p
  SET "game_id" = v_game_id,
      "article_id" = matched.article_id
  FROM (
    SELECT DISTINCT ON (pz."id")
      pz."id" AS puzzle_id,
      a."id" AS article_id
    FROM "labs"."rhobh_daily_puzzles" pz
    CROSS JOIN LATERAL jsonb_array_elements(pz."sources") AS src
    INNER JOIN "labs"."articles" a ON a."url" = (src ->> 'url')
    WHERE src ->> 'url' ILIKE '%realityblurb.com%'
    ORDER BY pz."id", src ->> 'url'
  ) AS matched
  WHERE matched.puzzle_id = p."id"
    AND p."article_id" IS NULL;

  -- Drop puzzles that could not be linked to a realityblurb article.
  DELETE FROM "labs"."rhobh_daily_puzzles"
  WHERE "article_id" IS NULL OR "game_id" IS NULL;

  -- One puzzle per calendar day for this game (keep earliest row).
  DELETE FROM "labs"."rhobh_daily_puzzles" p
  USING "labs"."rhobh_daily_puzzles" keeper
  WHERE p."date_utc" = keeper."date_utc"
    AND p."id" > keeper."id";
END $$;
--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ALTER COLUMN "game_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ALTER COLUMN "article_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ALTER COLUMN "date_utc" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ADD CONSTRAINT "rhobh_daily_puzzles_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "labs"."games"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."rhobh_daily_puzzles" ADD CONSTRAINT "rhobh_daily_puzzles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "labs"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_puzzles_game_date_idx" ON "labs"."rhobh_daily_puzzles" USING btree ("game_id","date_utc");--> statement-breakpoint
-- CONTRACT STEP — destructive, no rollback once run. The sources jsonb blob
-- has already been captured into `articles` by the backfill above (matched
-- by url), so this is a redundant-data cleanup, not a data-loss risk in
-- theory — but dry-run this migration against a staging copy of production
-- data first and diff `articles` row counts against distinct source urls
-- before trusting that the backfill covered every row.
ALTER TABLE "labs"."rhobh_daily_puzzles" DROP COLUMN "sources";
