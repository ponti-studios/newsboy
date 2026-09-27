import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium, type Page } from "playwright";

import { DEFAULT_GAME_SLUG } from "../src/lib/generation/catalog";
import { runScript } from "./_shared/run-script";

type ColorScheme = "light" | "dark";

/**
 * Captures a consistent reference screenshot of every game tile state
 * (correct / present / absent / typed / empty) at a set of device viewport
 * sizes, in both light and dark color schemes.
 *
 *   pnpm tsx scripts/game-tile-states.ts
 *
 * These are demonstration renders, not real gameplay: the script loads the
 * live board (for its CSS, fonts, and layout) then overwrites the first row
 * of tiles in-place with one fixed tile per state, so the result never
 * depends on today's actual puzzle/answer.
 */

const DEFAULT_BASE_URL = "https://newsboy.lvh.me";
const DEFAULT_OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/screenshots/tile-states",
);

// [letter, state] pairs, in board order. Covers every GameTileState.
const DEMO_TILES: Array<[string, string]> = [
  ["C", "correct"],
  ["R", "present"],
  ["A", "absent"],
  ["N", "typed"],
  ["", "empty"],
];

const DEVICES: Array<{ name: string; width: number; height: number }> = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const COLOR_SCHEMES: ColorScheme[] = ["light", "dark"];

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

/** Replaces the board's first guess row with one tile per state, in-place. */
async function injectDemoRow(page: Page) {
  await page.waitForSelector('[data-testid="game-tile-grid"]');
  await page.waitForSelector('[data-testid="onscreen-keyboard"]');

  await page.evaluate((tiles) => {
    const grid = document.querySelector('[data-testid="game-tile-grid"]');
    if (!grid) throw new Error("game-tile-grid not found");

    // Overwrite the board's first row in place (rather than inserting a new
    // one) so the row count and overall board height stay exactly what a
    // real game renders.
    const firstRow = grid.firstElementChild;
    if (!firstRow) throw new Error("game-tile-grid has no rows");

    // The tile skin is a CSS module with hashed class names, so copy the
    // class names from a live tile (and its letter span) instead of
    // hardcoding them; `data-state` drives the per-state colors.
    const protoTile = firstRow.querySelector('[data-testid="game-tile"]');
    if (!protoTile) throw new Error("game-tile-grid has no live tiles to copy styling from");
    const tileClass = protoTile.className;
    const letterClass = protoTile.firstElementChild?.className ?? "";

    firstRow.setAttribute("data-testid", "tile-state-demo");
    firstRow.innerHTML = "";

    for (const [letter, state] of tiles) {
      const tile = document.createElement("div");
      tile.className = tileClass;
      tile.dataset.state = state;
      const span = document.createElement("span");
      span.className = letterClass;
      span.textContent = letter;
      tile.appendChild(span);
      firstRow.appendChild(tile);
    }
  }, DEMO_TILES);

  return page.locator('[data-testid="tile-state-demo"]');
}

async function captureDevice(
  browser: import("playwright").Browser,
  opts: Options,
  device: (typeof DEVICES)[number],
  colorScheme: ColorScheme,
) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    colorScheme,
  });
  const page = await context.newPage();

  await page.goto(`${opts.baseUrl}/${DEFAULT_GAME_SLUG}`, { waitUntil: "networkidle" });
  const demoRow = await injectDemoRow(page);

  const rowOut = path.join(opts.outDir, `tile-states-${device.name}-${colorScheme}.png`);
  await demoRow.screenshot({ path: rowOut });
  console.log(`Saved: ${rowOut}`);

  const boardOut = path.join(opts.outDir, `board-${device.name}-${colorScheme}.png`);
  await page.screenshot({ path: boardOut });
  console.log(`Saved: ${boardOut}`);

  await context.close();
}

async function main() {
  const opts = parseOptions();
  await mkdir(opts.outDir, { recursive: true });

  const browser = await chromium.launch({ headless: opts.headless });

  try {
    for (const device of DEVICES) {
      for (const colorScheme of COLOR_SCHEMES) {
        await captureDevice(browser, opts, device, colorScheme);
      }
    }
  } finally {
    await browser.close();
  }
}

if (!process.env.VITEST) await runScript(main);
