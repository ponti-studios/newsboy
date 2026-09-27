/**
 * Seed everything a local dev needs to hit the ground running, without an LLM
 * call:
 *
 * - today's puzzle (plus `--days` ahead, optional `--answer` override for today);
 * - a deterministic 19-day *history scenario* (solved / failed / playing /
 *   unplayed days) so `/history` looks realistic.
 *
 * History attaches to a dedicated local test account (`test@lvh.me`, created
 * if missing) so devs can sign in and see the seeded plays; `--user-id`
 * overrides the target user.
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import { db, sql } from "@pontistudios/db";
import { addDaysToDateKey, getDateKey } from "../src/lib/puzzle/date";
import { ensureGameCatalog } from "../src/lib/generation/ingest.server";
import {
  ensureSeedPuzzle,
  requireSeedGame,
  seedAttempt,
  type SeedAttemptStatus,
} from "../src/lib/data/dev-seed.server";
import { runScript } from "./_shared/run-script";

const DEV_FEED_URL = "https://seed.local/game-dev-feed";
const HISTORY_FEED_URL = "https://seed.local/game-history-feed";
const TEST_USER_EMAIL = "test@lvh.me";
const TEST_USER_NAME = "Local Test";
const DEV_ANSWERS = ["DRAMA", "GLASS", "TOAST", "STORM", "TWIST", "CROWN", "SPARK"];
const HISTORY_LOOKBACK_DAYS = 19;
const HISTORY_ANSWERS = [
  "GLASS",
  "PORSH",
  "BRAWL",
  "SHADE",
  "TOAST",
  "CROWN",
  "STORM",
  "FEUDS",
  "TWIST",
  "REVEL",
  "GOSSY",
  "DRAMA",
  "VOICE",
  "TEARS",
  "LIMOS",
  "CHAMP",
  "GLARE",
  "SPARK",
  "TRUST",
];
const FILLER_GUESSES = ["ABASE", "ABASH"];
const SIX_WRONG_GUESSES = ["ABASE", "ABASH", "ABATE", "ABBEY", "ABACK", "ABAFT"];

function parseCliArgs() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      days: { type: "string" },
      answer: { type: "string" },
      "user-id": { type: "string" },
    },
    strict: true,
  });
  const days = values.days ? Number.parseInt(values.days, 10) : 1;
  if (!Number.isInteger(days) || days < 1)
    throw new Error(`--days must be a positive integer, got: ${values.days}`);
  return {
    days,
    answer: values.answer,
    userId: values["user-id"],
  };
}

/**
 * Ensure the dedicated local test account exists and return it.
 *
 * Better Auth owns Hominem's users table; this dev-only path creates a
 * deterministic `test@lvh.me` account (idempotent) so seeded plays land on a
 * user a dev can actually sign in as.
 */
async function ensureTestUser(): Promise<{ id: string; email: string }> {
  let rows: Array<{ id: string; email: string }> = [];
  try {
    rows = (await db.execute(
      sql`SELECT id, email FROM public."user" WHERE email = ${TEST_USER_EMAIL}`,
    )) as unknown as Array<{ id: string; email: string }>;
  } catch {
    throw new Error(
      `Could not read Hominem's user table to find ${TEST_USER_EMAIL} — is the local auth schema present? ` +
        "Pass --user-id to seed a specific user instead.",
    );
  }
  if (rows.length > 0) return rows[0];

  const id = randomUUID();
  await db.execute(
    sql`INSERT INTO public."user" (id, name, email, "emailVerified") VALUES (${id}, ${TEST_USER_NAME}, ${TEST_USER_EMAIL}, true)`,
  );
  console.log(`Created local test user ${TEST_USER_EMAIL}`);
  return { id, email: TEST_USER_EMAIL };
}

async function seedDevDays(gameId: number, days: number, answer?: string) {
  console.log(`Seeding ${days} day(s) of game dev fixtures\n`);

  const today = getDateKey(new Date(), "UTC");
  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = offset === 0 ? today : addDaysToDateKey(today, offset);
    if (!dateKey) continue;
    const rawAnswer =
      offset === 0 && answer ? answer : DEV_ANSWERS[offset % DEV_ANSWERS.length];
    const puzzle = await ensureSeedPuzzle(gameId, dateKey, rawAnswer, {
      articleUrl: `${DEV_FEED_URL}/${dateKey}`,
      cluePrefix: "Dev fixture clue",
      detailPrefix: "Dev fixture story detail",
    });
    console.log(`  ${dateKey}: seeded (${puzzle.answer})`);
  }
  console.log("\nDone. View: https://newsboy.lvh.me/reality");
}

async function seedHistoryScenario(
  gameId: number,
  user: { id: string; email?: string },
) {
  const today = getDateKey(new Date(), "UTC");
  const label = user.email && user.email !== user.id ? user.email : user.id;
  const plan: Array<{ offset: number; status: SeedAttemptStatus }> = [
    ...[1, 2, 3, 4, 5].map((offset) => ({ offset, status: "solved" as const })),
    { offset: 6, status: "failed" },
    { offset: 7, status: "playing" },
    ...[8, 9, 10, 11, 12].map((offset) => ({ offset, status: "solved" as const })),
    ...[13, 14, 15, 16, 17, 18, 19].map((offset) => ({ offset, status: "unplayed" as const })),
  ];

  console.log(`\nSeeding game history for ${label}\n`);
  for (const { offset, status } of plan) {
    const dateKey = addDaysToDateKey(today, -offset);
    if (!dateKey) continue;
    const answer = HISTORY_ANSWERS[offset - 1] ?? "DRAMA";
    const puzzle = await ensureSeedPuzzle(gameId, dateKey, answer, {
      articleUrl: `${HISTORY_FEED_URL}/${dateKey}`,
      cluePrefix: "Seed clue",
      detailPrefix: "Seed story detail",
    });
    await seedAttempt(user.id, gameId, dateKey, puzzle.answer, status, {
      solved: FILLER_GUESSES,
      failed: SIX_WRONG_GUESSES,
      playing: FILLER_GUESSES,
    });
    console.log(`  ${dateKey}: seeded ${status}`);
  }

  console.log(
    `\nDone. Seeded ${HISTORY_LOOKBACK_DAYS} days (through ${addDaysToDateKey(today, -HISTORY_LOOKBACK_DAYS)}) for ${label}.`,
  );
  console.log("View: https://newsboy.lvh.me/history");
}

async function main() {
  const { days, answer, userId } = parseCliArgs();
  await ensureGameCatalog();
  const game = await requireSeedGame();

  await seedDevDays(game.id, days, answer);

  const historyUser = userId ? { id: userId, email: userId } : await ensureTestUser();
  await seedHistoryScenario(game.id, historyUser);
}

if (!process.env.VITEST) await runScript(main);