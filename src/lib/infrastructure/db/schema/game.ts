import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { labs } from "./base";

// ── games_topics ─────────────────────────────────────────────────────────────
// Entity: a durable What topic and its source feed. These used to be
// separate game + feed rows connected by feed_games, but the catalog is
// intentionally one topic per feed, so the join carried no independent
// meaning.

export const gamesTopics = labs.table("games_topics", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull().unique(),
  feedKind: text("feed_kind", { enum: ["rss"] })
    .notNull()
    .default("rss"),
  feedLabel: text("feed_label").notNull(),
  systemPromptPath: text("system_prompt_path").notNull(),
  answerLength: integer("answer_length").notNull().default(5),
  repeatWindowDays: integer("repeat_window_days").notNull().default(90),
  articleExpiryDays: integer("article_expiry_days").notNull().default(45),
  active: boolean("active").notNull().default(true),
  activationPending: boolean("activation_pending").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── articles ─────────────────────────────────────────────────────────────────
// Entity: an ingested article, unique by URL within a games_topic. A story may
// appear in more than one topic feed, and its status/lifecycle is topic-scoped.

export const articleStatusValues = ["pending", "used", "rejected", "expired"] as const;
export type ArticleStatus = (typeof articleStatusValues)[number];

export const articles = labs.table(
  "articles",
  {
    id: serial("id").primaryKey(),
    gamesTopicId: integer("games_topic_id")
      .notNull()
      .references(() => gamesTopics.id, { onDelete: "restrict" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    articleText: text("article_text"),
    articleTextStatus: text("article_text_status", { enum: ["pending", "succeeded", "failed"] })
      .notNull()
      .default("pending"),
    articleTextAttempts: integer("article_text_attempts").notNull().default(0),
    articleTextAttemptedAt: timestamp("article_text_attempted_at"),
    articleTextNextAttemptAt: timestamp("article_text_next_attempt_at"),
    articleTextError: text("article_text_error"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    status: text("status", { enum: articleStatusValues }).notNull().default("pending"),
    rejectionCount: integer("rejection_count").notNull().default(0),
    rejectionReason: text("rejection_reason"),
  },
  (table) => [
    uniqueIndex("articles_games_topic_url_idx").on(table.gamesTopicId, table.url),
    index("articles_status_idx").on(table.status),
    index("articles_published_at_idx").on(table.publishedAt),
  ],
);

export const generationRunStatusValues = ["running", "succeeded", "failed"] as const;
export type GenerationRunStatus = (typeof generationRunStatusValues)[number];

export const generationSourceModeValues = [
  "inventory",
  "feeds",
  "articles",
  "rss",
  "fixtures",
] as const;
export type GenerationSourceMode = (typeof generationSourceModeValues)[number];

export const generationPromptSourceValues = ["file", "paste"] as const;
export type GenerationPromptSource = (typeof generationPromptSourceValues)[number];

// What actually initiated the run — orthogonal to sourceMode, which is about
// where the ARTICLES came from, not who/what asked the model to run.
export const generationTriggerValues = ["admin_ui", "cron", "cli"] as const;
export type GenerationTrigger = (typeof generationTriggerValues)[number];

// Where the process ran. Derived automatically from env vars, never user-supplied.
export const generationEnvironmentValues = [
  "local",
  "github_actions",
  "railway",
  "production",
  "unknown",
] as const;
export type GenerationEnvironment = (typeof generationEnvironmentValues)[number];

// "default" omits the reasoning param entirely and lets the provider decide.
export const reasoningEffortValues = [
  "default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
] as const;
export type ReasoningEffort = (typeof reasoningEffortValues)[number];

export const gameAdminActionKindValues = [
  "preview",
  "generate",
  "publish",
  "replace",
  "hand_edit",
  "ingest",
  "gap_fill",
  "gap_fill_one",
  "regenerate_dry_run",
  "dispatch_generate",
  "lock_busy",
  "generation_circuit_open",
] as const;
export type GameAdminActionKind = (typeof gameAdminActionKindValues)[number];

// ── game_generation_runs ─────────────────────────────────────────────────
// Event: one generation (or compare-leg). Not the published puzzle.
// Retention may delete these rows; published games_puzzles.generation_run_id
// must SET NULL so live inventory is not deleted or blocked.

export const generationRuns = labs.table(
  "game_generation_runs",
  {
    id: serial("id").primaryKey(),
    // Nullable: CLI eval/preview scripts can run against an ad-hoc --feed-url
    // with no corresponding games_topics row, but we still want their cost tracked.
    gamesTopicId: integer("games_topic_id").references(() => gamesTopics.id, {
      onDelete: "restrict",
    }),
    dateKey: date("date_key").notNull(),
    status: text("status", { enum: generationRunStatusValues }).notNull().default("running"),
    sourceMode: text("source_mode", { enum: generationSourceModeValues }).notNull(),
    articleIds: jsonb("article_ids").$type<number[]>().notNull().default([]),
    promptSource: text("prompt_source", { enum: generationPromptSourceValues }).notNull(),
    promptPath: text("prompt_path"),
    promptText: text("prompt_text").notNull(),
    model: text("model").notNull(),
    excludedAnswerCount: integer("excluded_answer_count").notNull().default(0),
    feedItemCount: integer("feed_item_count").notNull().default(0),
    selectedIndex: integer("selected_index"),
    feedError: text("feed_error"),
    llmError: text("llm_error"),
    compareGroupId: text("compare_group_id"),
    requestedMaxTokens: integer("requested_max_tokens"),
    reasoningEffort: text("reasoning_effort", { enum: reasoningEffortValues }),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    totalTokens: integer("total_tokens"),
    costUsd: doublePrecision("cost_usd"),
    trigger: text("trigger", { enum: generationTriggerValues }),
    environment: text("environment", { enum: generationEnvironmentValues }),
    publishable: boolean("publishable").notNull().default(false),
    createdByHominemUserId: text("created_by_hominem_user_id").notNull(),
    createdByEmail: text("created_by_email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [
    index("game_generation_runs_topic_created_idx").on(table.gamesTopicId, table.createdAt),
    index("game_generation_runs_date_created_idx").on(table.dateKey, table.createdAt),
  ],
);

// ── game_generation_candidates ───────────────────────────────────────────
// Child of a run. article_id is required before publish; null for rss/fixtures.

export const generationCandidates = labs.table(
  "game_generation_candidates",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    payload: jsonb("payload").notNull(),
    normalizedAnswer: text("normalized_answer").notNull(),
    valid: boolean("valid").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    handEdited: boolean("hand_edited").notNull().default(false),
    articleId: integer("article_id").references(() => articles.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("game_generation_candidates_run_ordinal_idx").on(table.runId, table.ordinal),
  ],
);

// ── games_puzzles ────────────────────────────────────────────────────────────
// Entity: a puzzle for one game on one date, generated from exactly one
// article. Generalized from the original game-specific puzzle table —
// games_topic_id replaces the implicit single-game assumption, article_id replaces the
// jsonb sources array now that generation is strictly one-article-in.
//
// Provenance columns are nullable so existing rows stay valid. generation_run_id
// is SET NULL on run delete — never cascade, never restrict.

export const gamesPuzzles = labs.table(
  "games_puzzles",
  {
    id: serial("id").primaryKey(),
    gamesTopicId: integer("games_topic_id")
      .notNull()
      .references(() => gamesTopics.id, { onDelete: "restrict" }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    dateUtc: date("date_utc").notNull(),
    answer: text("answer").notNull(),
    answerType: text("answer_type").$type<PuzzleAnswerType>().notNull(),
    normalizedAnswer: text("normalized_answer").notNull(),
    clue: text("clue").notNull(),
    detail: text("detail").notNull(),
    promptPath: text("prompt_path"),
    model: text("model"),
    generationRunId: integer("generation_run_id").references(() => generationRuns.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("normalized_answer_length", sql`length(${table.normalizedAnswer}) = 5`),
    uniqueIndex("games_puzzles_games_topic_date_idx").on(table.gamesTopicId, table.dateUtc),
  ],
);

export type PuzzleAnswerType = "moment" | "object" | "phrase" | "place" | "storyline";

// ── games_attempts ────────────────────────────────────────────────────────
// Entity: one signed-in player's progress on one game's puzzle for one date.
// This is the authoritative guess history — before it existed, the guess API
// trusted a client-supplied `previousGuesses` array for both the six-guess cap
// and the already-guessed check, so a scripted client could bypass either.
//
// There is no FK on hominem_user_id: Better Auth owns the users table and it
// lives in Hominem's database, not this one. Anonymous players get no row at
// all — their single free guess is evaluated without being persisted.

export const attemptStatusValues = ["playing", "solved", "failed"] as const;
export type AttemptStatus = (typeof attemptStatusValues)[number];

/**
 * Persisted shape of a scored guess. Kept structurally identical to
 * `GameGuess` in app/lib/game/core/types.ts, but declared here rather
 * than imported: the domain types sit above this schema, so importing back
 * would be circular. Drift will fail repository tests.
 */
type StoredGuess = {
  word: string;
  states: ("absent" | "correct" | "present")[];
};

export const gamesAttempts = labs.table(
  "games_attempts",
  {
    id: serial("id").primaryKey(),
    hominemUserId: text("hominem_user_id").notNull(),
    gamesTopicId: integer("games_topic_id")
      .notNull()
      .references(() => gamesTopics.id, { onDelete: "cascade" }),
    dateUtc: date("date_utc").notNull(),
    guesses: jsonb("guesses").$type<StoredGuess[]>().notNull().default([]),
    /**
     * ISO timestamp per entry in `guesses`, same order. Backs the
     * guesses-per-minute limit, which is per-player across puzzles (players
     * may work through older unplayed dates), so it cannot be derived from a
     * single row's six-guess cap alone — see countRecentGuesses.
     */
    guessedAt: jsonb("guessed_at").$type<string[]>().notNull().default([]),
    status: text("status", { enum: attemptStatusValues }).notNull().default("playing"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("games_attempts_user_games_topic_date_idx").on(
      table.hominemUserId,
      table.gamesTopicId,
      table.dateUtc,
    ),
    // Narrows the rate-limit scan to rows the player touched recently instead
    // of every attempt they have ever created.
    index("games_attempts_user_updated_idx").on(table.hominemUserId, table.updatedAt),
  ],
);

export const gameEvents = labs.table(
  "game_events",
  {
    id: serial("id").primaryKey(),
    event: text("event", {
      enum: ["game_started", "guess_made", "game_won", "game_lost", "shared", "clue_used"],
    }).notNull(),
    sessionId: text("session_id").notNull(),
    topicSlug: text("topic_slug").notNull(),
    puzzleDate: date("puzzle_date").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    clueCount: integer("clue_count").notNull().default(0),
    acquisitionSource: text("acquisition_source"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("game_events_created_at_idx").on(table.createdAt),
    index("game_events_session_puzzle_idx").on(table.sessionId, table.topicSlug, table.puzzleDate),
  ],
);

// ── game_puzzle_revisions ────────────────────────────────────────────────
// Snapshot of a published row (and deleted attempts) before an in-place replace.
// puzzle_id stays the live games_puzzles.id; replace does not insert a new puzzle.

export const puzzleRevisions = labs.table("game_puzzle_revisions", {
  id: serial("id").primaryKey(),
  gamesTopicId: integer("games_topic_id")
    .notNull()
    .references(() => gamesTopics.id, { onDelete: "restrict" }),
  dateUtc: date("date_utc").notNull(),
  puzzleId: integer("puzzle_id")
    .notNull()
    .references(() => gamesPuzzles.id, { onDelete: "restrict" }),
  snapshot: jsonb("snapshot").notNull(),
  attemptsSnapshot: jsonb("attempts_snapshot").notNull(),
  replacedByHominemUserId: text("replaced_by_hominem_user_id").notNull(),
  replacedAt: timestamp("replaced_at").defaultNow().notNull(),
});

// ── game_admin_actions ───────────────────────────────────────────────────
// Audit of operator commands. Never store ADMIN_SECRET in payload/result.

export const adminActions = labs.table(
  "game_admin_actions",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at").defaultNow().notNull(),
    hominemUserId: text("hominem_user_id").notNull(),
    kind: text("kind", { enum: gameAdminActionKindValues }).notNull(),
    gamesTopicId: integer("games_topic_id")
      .notNull()
      .references(() => gamesTopics.id, { onDelete: "restrict" }),
    dateUtc: date("date_utc"),
    dryRun: boolean("dry_run").notNull().default(false),
    payload: jsonb("payload").notNull().default({}),
    result: jsonb("result").notNull().default({}),
  },
  (table) => [
    index("game_admin_actions_at_idx").on(table.at),
    index("game_admin_actions_kind_at_idx").on(table.kind, table.at),
    index("game_admin_actions_date_idx").on(table.dateUtc),
  ],
);

export type GamesTopic = typeof gamesTopics.$inferSelect;
export type NewGamesTopic = typeof gamesTopics.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type GamesPuzzle = typeof gamesPuzzles.$inferSelect;
export type NewGamesPuzzle = typeof gamesPuzzles.$inferInsert;
export type GamesAttempt = typeof gamesAttempts.$inferSelect;
export type NewGamesAttempt = typeof gamesAttempts.$inferInsert;
export type GenerationRun = typeof generationRuns.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;
export type GenerationCandidate = typeof generationCandidates.$inferSelect;
export type NewGenerationCandidate = typeof generationCandidates.$inferInsert;
export type PuzzleRevision = typeof puzzleRevisions.$inferSelect;
export type NewPuzzleRevision = typeof puzzleRevisions.$inferInsert;
export type AdminAction = typeof adminActions.$inferSelect;
export type NewAdminAction = typeof adminActions.$inferInsert;
