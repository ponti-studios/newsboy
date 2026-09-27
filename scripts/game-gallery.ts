import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium, type Page } from "playwright";

import { getDateKey } from "../src/lib/puzzle/date";
import { getGameBySlug } from "../src/lib/data/games.server";
import { loadMostRecentPuzzle, loadPuzzleForDate } from "../src/lib/data/puzzles.server";
import { runScript } from "./_shared/run-script";

/**
 * Captures gallery-ready assets for the game:
 *
 * Both look up the real answer being served today (same fallback the app
 * itself uses — today's puzzle, or the most recent one if today's hasn't been
 * generated yet) and play it out with two throwaway probe guesses before
 * finishing on the answer.
 *
 * `screenshot` writes the two static images referenced by
 * app/data/projects.ts (public/screenshots/game-gameplay.png,
 * game-solved.png) — do not rename these without updating that file.
 * `solve` records the whole sequence as a video instead (not wired into the
 * project gallery; useful for social/demo purposes).
 */

const GAME_SLUG = "reality";
const DEFAULT_BASE_URL = "https://newsboy.lvh.me";
// Matches the `screenshots: ["/screenshots/..."]` paths in app/data/projects.ts,
// which are served from this app's own /public directory.
const DEFAULT_OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/screenshots",
);

// Real dictionary words used only to narrow down letters before the final,
// correct guess. Automatically skipped if one happens to equal the answer.
const OPENING_PROBES = ["ARISE", "PROXY"];

interface Options {
  mode: "screenshot" | "solve";
  baseUrl: string;
  outDir: string;
  headless: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      mode: { type: "string" },
      "base-url": { type: "string" },
      "out-dir": { type: "string" },
      headed: { type: "boolean", default: false },
    },
    strict: true,
  });

  return {
    mode: values.mode === "solve" ? "solve" : "screenshot",
    baseUrl: values["base-url"] ?? DEFAULT_BASE_URL,
    outDir: values["out-dir"] ? path.resolve(values["out-dir"]) : DEFAULT_OUT_DIR,
    headless: !values.headed,
  };
}

async function resolveTodaysAnswer(): Promise<string> {
  const game = await getGameBySlug(GAME_SLUG);
  if (!game) throw new Error(`Game not found: ${GAME_SLUG}`);

  const dateKey = getDateKey(new Date());
  const puzzle =
    (await loadPuzzleForDate(game.id, dateKey)) ?? (await loadMostRecentPuzzle(game.id));
  if (!puzzle) throw new Error("No puzzle available in the database");

  return puzzle.answer.toUpperCase();
}

function buildGuessSequence(answer: string): string[] {
  return [...OPENING_PROBES.filter((word) => word !== answer), answer];
}

async function clickKey(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(120);
}

async function typeWord(page: Page, word: string) {
  for (const letter of word) await clickKey(page, letter);
  await page.waitForTimeout(250);
  await clickKey(page, "Enter");
  await page.waitForTimeout(1800); // let the flip/reveal animation play out
}

async function resetBoard(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
}

async function captureScreenshots(opts: Options) {
  const answer = await resolveTodaysAnswer();
  const guesses = buildGuessSequence(answer);
  if (guesses.length < 2) {
    throw new Error("Need at least 2 guesses (probe + answer) to capture a mid-game state");
  }

  const browser = await chromium.launch({ headless: opts.headless });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await resetBoard(page, `${opts.baseUrl}/${GAME_SLUG}`);

    // Play every guess except the last (the answer) first, so the board shows
    // real yellow/gray feedback without being solved yet.
    for (const guess of guesses.slice(0, -1)) await typeWord(page, guess);
    const gameplayOut = path.join(opts.outDir, "game-gameplay.png");
    await page.screenshot({ path: gameplayOut });
    console.log(`Saved screenshot: ${gameplayOut}`);

    // Final guess solves it.
    await typeWord(page, guesses[guesses.length - 1]);
    await page.waitForTimeout(500);
    const solvedOut = path.join(opts.outDir, "game-solved.png");
    await page.screenshot({ path: solvedOut });
    console.log(`Saved screenshot: ${solvedOut}`);
    console.log(`Answer solved: ${answer} (guesses: ${guesses.join(", ")})`);
  } finally {
    await browser.close();
  }
}

async function captureSolveVideo(opts: Options) {
  const answer = await resolveTodaysAnswer();
  const guesses = buildGuessSequence(answer);

  const videoDir = path.join(opts.outDir, ".video-tmp");
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: opts.headless });
  const context = await browser.newContext({
    viewport: { width: 900, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 900, height: 900 } },
  });
  const page = await context.newPage();

  await resetBoard(page, `${opts.baseUrl}/${GAME_SLUG}`);
  for (const guess of guesses) await typeWord(page, guess);
  await page.waitForTimeout(2500); // hold on the solved state

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const recordedPath = await video?.path();
  if (!recordedPath) throw new Error("Playwright did not produce a video file");

  const webmOut = path.join(opts.outDir, "game-solve.webm");
  await rename(recordedPath, webmOut);
  await rm(videoDir, { recursive: true, force: true });

  const mp4Out = webmOut.replace(/\.webm$/, ".mp4");
  console.log(`Saved video: ${webmOut}`);
  console.log(`Answer solved: ${answer} (guesses: ${guesses.join(", ")})`);
  console.log(
    `Optional mp4 conversion: ffmpeg -y -i "${webmOut}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Out}"`,
  );
}

async function main() {
  const opts = parseOptions();
  await mkdir(opts.outDir, { recursive: true });

  if (opts.mode === "screenshot") {
    await captureScreenshots(opts);
  } else {
    await captureSolveVideo(opts);
  }
}

if (!process.env.VITEST) await runScript(main);
