import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium, type Page } from "playwright";

import { getDateKey } from "../src/lib/puzzle/date";
import { DEFAULT_GAME_SLUG, getTopicEmoji } from "../src/lib/generation/catalog";
import { getGameBySlug } from "../src/lib/data/games.server";
import { loadMostRecentPuzzle, loadPuzzleForDate } from "../src/lib/data/puzzles.server";
import { runScript } from "./_shared/run-script";

const DEFAULT_BASE_URL = "https://newsboy.lvh.me";
const DEFAULT_OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../tmp/game-e2e",
);

interface Options {
  baseUrl: string;
  outDir: string;
  headless: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "base-url": { type: "string" },
      "out-dir": { type: "string" },
      headed: { type: "boolean", default: false },
    },
    strict: true,
  });

  return {
    baseUrl: values["base-url"] ?? DEFAULT_BASE_URL,
    outDir: values["out-dir"] ? path.resolve(values["out-dir"]) : DEFAULT_OUT_DIR,
    headless: !values.headed,
  };
}

async function resolveTodaysAnswer(): Promise<{ answer: string; dateKey: string }> {
  const game = await getGameBySlug(DEFAULT_GAME_SLUG);
  if (!game) throw new Error(`Game not found: ${DEFAULT_GAME_SLUG}`);

  const dateKey = getDateKey(new Date(), "UTC");
  const puzzle =
    (await loadPuzzleForDate(game.id, dateKey)) ?? (await loadMostRecentPuzzle(game.id, dateKey));
  if (!puzzle) throw new Error("No puzzle available in the database");

  return { answer: puzzle.answer.toUpperCase(), dateKey: puzzle.dateUtc };
}

class Probe {
  failures: string[] = [];
  passes: string[] = [];

  check(name: string, ok: boolean, detail?: string) {
    if (ok) {
      this.passes.push(name);
      console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
    } else {
      this.failures.push(detail ? `${name}: ${detail}` : name);
      console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    }
  }

  async shot(page: Page, outDir: string, name: string) {
    await page.screenshot({
      path: path.join(outDir, `${name}.png`),
      fullPage: true,
    });
  }
}

function testId(page: Page, id: string) {
  return page.getByTestId(id);
}

async function openGame(page: Page, url: string) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(url, { waitUntil: "networkidle" });
  await testId(page, "game-tile-grid").waitFor({ timeout: 15_000 });
}

async function typedLetters(page: Page): Promise<string> {
  return page
    .locator('[data-testid="game-tile"][data-state="typed"] .game-tile-letter')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? "").join(""));
}

async function clickLetter(page: Page, letter: string) {
  await testId(page, `keyboard-key-${letter}`).click();
}

async function clickEnter(page: Page) {
  await testId(page, "keyboard-key-enter").click();
}

async function clickBackspace(page: Page) {
  await testId(page, "keyboard-key-backspace").click();
}

async function typeOnscreenWord(page: Page, word: string) {
  for (const letter of word) await clickLetter(page, letter);
  await clickEnter(page);
}

async function waitForError(page: Page, code: string) {
  await page.locator(`[data-testid="game-status"][data-error="${code}"]`).waitFor({
    timeout: 8_000,
  });
}

async function waitForReveal(page: Page) {
  await page
    .locator(
      '[data-testid="game-tile"][data-state="correct"], [data-testid="game-tile"][data-state="present"], [data-testid="game-tile"][data-state="absent"]',
    )
    .first()
    .waitFor({ timeout: 8_000 });
  await page.waitForTimeout(1800);
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

async function run(opts: Options) {
  const probe = new Probe();
  await mkdir(opts.outDir, { recursive: true });

  const { answer } = await resolveTodaysAnswer();
  const probeWord = answer === "ARISE" ? "STARE" : "ARISE";
  const gameUrl = `${opts.baseUrl}/${DEFAULT_GAME_SLUG}`;

  const browser = await chromium.launch({ headless: opts.headless });
  try {
    const desktop = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      timezoneId: "UTC",
    });

    console.log("\n[load]");
    await openGame(desktop, gameUrl);
    await probe.shot(desktop, opts.outDir, "01-load");
    probe.check("logo present", await testId(desktop, "game-logo").isVisible());
    const iconHrefs = await desktop
      .locator('link[rel="icon"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
    probe.check(
      "Game favicon link present",
      iconHrefs.some((href) => href.includes("favicon.ico")),
      iconHrefs.join(", "),
    );
    probe.check(
      "studio favicon is not also declared",
      !iconHrefs.some((href) => href === "/favicon.png" || href.endsWith("/favicon.png")),
      iconHrefs.join(", "),
    );
    const tileCount = await testId(desktop, "game-tile").count();
    probe.check("grid is 6×5", tileCount === 30, `got ${tileCount}`);
    probe.check(
      "onscreen keyboard visible",
      await testId(desktop, "onscreen-keyboard").isVisible(),
    );
    probe.check("history control present", await testId(desktop, "game-history-link").isVisible());
    const historyRole = await testId(desktop, "game-history-link").getAttribute("role");
    probe.check("history control is a link", historyRole !== "button", `role=${historyRole}`);

    console.log("\n[physical keyboard]");
    await desktop.keyboard.type("ABC");
    probe.check(
      "types letters into current row",
      (await typedLetters(desktop)).replace(/\s/g, "") === "ABC",
    );
    await desktop.keyboard.press("Backspace");
    probe.check(
      "backspace removes last letter",
      (await typedLetters(desktop)).replace(/\s/g, "") === "AB",
    );
    await desktop.keyboard.press("Enter");
    await waitForError(desktop, "wrong-length");
    probe.check("short submit sets wrong-length error", true);
    await probe.shot(desktop, opts.outDir, "02-not-enough-letters");

    console.log("\n[onscreen keyboard + invalid word]");
    await clickBackspace(desktop);
    await clickBackspace(desktop);
    await typeOnscreenWord(desktop, "XXXXX");
    await waitForError(desktop, "not-in-word-list");
    probe.check("invalid word sets not-in-word-list error", true);
    probe.check(
      "invalid word stays on the current row",
      (await typedLetters(desktop)).replace(/\s/g, "") === "XXXXX",
    );
    await probe.shot(desktop, opts.outDir, "03-not-in-word-list");

    console.log("\n[duplicate + free guess]");
    for (let i = 0; i < 5; i++) await clickBackspace(desktop);
    await typeOnscreenWord(desktop, probeWord);
    await waitForReveal(desktop);
    await probe.shot(desktop, opts.outDir, "04-after-free-guess");
    const revealed = await desktop
      .locator(
        '[data-testid="game-tile"][data-state="correct"], [data-testid="game-tile"][data-state="present"], [data-testid="game-tile"][data-state="absent"]',
      )
      .count();
    probe.check("free guess reveals tile states", revealed === 5, `revealed ${revealed}`);
    probe.check(
      "guest auth wall after unsuccessful guess",
      await testId(desktop, "game-auth-required").isVisible(),
    );
    probe.check(
      "keyboard hidden after free guess",
      !(await testId(desktop, "onscreen-keyboard").isVisible()),
    );

    console.log("\n[history — guest]");
    await testId(desktop, "game-history-link").click();
    await testId(desktop, "game-history-guest").waitFor({ timeout: 8_000 });
    probe.check("guest history shows sign-in state", true);
    await probe.shot(desktop, opts.outDir, "05-history-guest");
    await desktop.close();

    console.log("\n[first-guess solve]");
    const solve = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      timezoneId: "UTC",
    });
    console.log(`  using answer ${answer}`);
    await openGame(solve, gameUrl);
    await typeOnscreenWord(solve, answer);
    await waitForReveal(solve);
    await probe.shot(solve, opts.outDir, "06-solved");
    const correctCount = await solve
      .locator('[data-testid="game-tile"][data-state="correct"]')
      .count();
    probe.check(
      "first guess marks all five tiles correct",
      correctCount === 5,
      `correct=${correctCount}`,
    );
    const resultBadge = testId(solve, "game-result-badge");
    probe.check(
      "solved badge is present",
      (await resultBadge.getAttribute("data-solved")) === "true" &&
        (await resultBadge.getAttribute("data-guesses")) === "1",
    );
    probe.check("receipt is present", await testId(solve, "game-receipt").isVisible());
    probe.check("share control is present", await testId(solve, "game-share").isVisible());
    probe.check("copy control is present", await testId(solve, "game-copy-story").isVisible());
    probe.check(
      "keyboard hidden after solve",
      !(await testId(solve, "onscreen-keyboard").isVisible()),
    );

    // First-guess solve marks every tile correct, so the emoji grid is a
    // single line of five copies of the topic's tile — match that whole
    // line rather than a single character, which the header text also contains.
    const correctTile = getTopicEmoji(DEFAULT_GAME_SLUG);
    const shareRowPattern = new RegExp(`^(?:${correctTile}){5}$`, "mu");

    await solve.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await testId(solve, "game-share").click();
    const shared = await solve.evaluate(async () => navigator.clipboard.readText());
    probe.check("share copies an emoji grid", shareRowPattern.test(shared), JSON.stringify(shared));
    await testId(solve, "game-copy-story").click();
    const story = await solve.evaluate(async () => navigator.clipboard.readText());
    probe.check("copy story writes share text", shareRowPattern.test(story), story.slice(0, 80));
    await probe.shot(solve, opts.outDir, "06b-after-share");
    await solve.close();

    console.log("\n[topic switch]");
    const topic = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      timezoneId: "UTC",
    });
    await openGame(topic, gameUrl);
    await testId(topic, "game-topic-select").click();
    const currentSlug = await testId(topic, "game-topic").getAttribute("data-slug");
    const nextOption = topic
      .locator(
        `[data-testid^="game-topic-option-"]:not([data-testid="game-topic-option-${currentSlug}"])`,
      )
      .first();
    const nextTestId = await nextOption.getAttribute("data-testid");
    const nextSlug = nextTestId?.replace("game-topic-option-", "") ?? "";
    await nextOption.click();
    await topic.waitForURL(new RegExp(`[?&]game=${nextSlug}\\b`));
    probe.check(
      "topic change updates the URL",
      topic.url().includes(`game=${nextSlug}`),
      topic.url(),
    );
    await topic
      .locator(`[data-testid="game-topic"][data-slug="${nextSlug}"]`)
      .waitFor({ timeout: 8_000 });
    probe.check(
      "topic control reflects the new slug",
      (await testId(topic, "game-topic").getAttribute("data-slug")) === nextSlug,
      nextSlug,
    );
    await probe.shot(topic, opts.outDir, "09-topic-switch");
    await topic.close();

    console.log("\n[mobile overflow]");
    for (const { name, width, height } of [
      { name: "07-mobile-390", width: 390, height: 844 },
      { name: "08-mobile-320", width: 320, height: 568 },
    ]) {
      const mobile = await browser.newPage({ viewport: { width, height }, timezoneId: "UTC" });
      await openGame(mobile, gameUrl);
      const overflow = await hasHorizontalOverflow(mobile);
      probe.check(`${width}px has no horizontal overflow`, !overflow);
      probe.check(
        `${width}px keyboard still visible`,
        await testId(mobile, "onscreen-keyboard").isVisible(),
      );
      await probe.shot(mobile, opts.outDir, name);
      await mobile.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${probe.passes.length} passed, ${probe.failures.length} failed`);
  console.log(`Screenshots: ${opts.outDir}`);
  if (probe.failures.length > 0) {
    console.log("Failures:");
    for (const failure of probe.failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

if (!process.env.VITEST) await runScript(() => run(parseOptions()));
