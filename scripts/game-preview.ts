import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { getDateKey } from "../src/lib/puzzle/date";
import {
  DEFAULT_GENERATION_PROMPT_PATH,
  detectRunEnvironment,
  generateCandidates,
  getSystemPromptForGame,
} from "../src/lib/generation/generate.server";
import type { GenerateCandidatesResult } from "../src/lib/generation/types";
import { getConfiguredTextModel } from "@pontistudios/ai";
import { db, eq, generationRuns } from "@pontistudios/db";
import { runScript } from "./_shared/run-script";

const CLI_ACTOR = "cli:game-preview";

interface PreviewOptions {
  dateKey: string;
  feedUrl?: string;
  promptFile?: string;
}

function parsePreviewArgs(): PreviewOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "date-key": { type: "string" },
      "feed-url": { type: "string" },
      "prompt-file": { type: "string" },
    },
    strict: true,
  });
  return {
    dateKey: values["date-key"] ?? getDateKey(new Date()),
    feedUrl: values["feed-url"],
    promptFile: values["prompt-file"],
  };
}

const DIVIDER = "━".repeat(50);

function printFeedSection(result: GenerateCandidatesResult) {
  console.log(`\nFEED (${result.feedItemCount} items)`);
  if (result.feedItemCount === 0) {
    console.log("  (no items retrieved)");
    return;
  }
  result.feedItems.slice(0, 10).forEach((item, i) => {
    const date = item.pubDate ? ` (${item.pubDate.slice(0, 16)})` : "";
    console.log(`  ${i + 1}. "${item.title}"${date}`);
  });
  if (result.feedItemCount > 10) {
    console.log(`  ... and ${result.feedItemCount - 10} more`);
  }
}

function printCandidatesSection(result: GenerateCandidatesResult) {
  console.log(`\n${DIVIDER}\n`);
  console.log(`CANDIDATES (${result.candidates.length} from LLM)\n`);

  if (result.candidates.length === 0) {
    console.log("  (no candidates returned)");
    return;
  }

  result.candidates.forEach(({ candidate, validation }, i) => {
    const isSelected = result.selectedIndex === i;
    const status = validation.valid ? `✓ PASS${isSelected ? "  ← SELECTED" : ""}` : "✗ FAIL";

    console.log(`[${i + 1}]  ${candidate.answer}  (${candidate.answerType})  ${status}`);
    console.log(`  Clue:   "${candidate.clue}"`);
    if (validation.valid) {
      if (candidate.detail) {
        const detail =
          candidate.detail.slice(0, 100) + (candidate.detail.length > 100 ? "..." : "");
        console.log(`  Detail: "${detail}"`);
      }
      candidate.sources.forEach((s) => console.log(`  Source: ${s.url} — ${s.title}`));
    } else {
      validation.reasons.forEach((r) => console.log(`  Reason: ${r}`));
    }
    console.log();
  });
}

function printResultSection(result: GenerateCandidatesResult) {
  console.log(DIVIDER);
  console.log("\nRESULT");

  const validCount = result.candidates.filter((c) => c.validation.valid).length;
  const total = result.candidates.length;

  if (result.selectedIndex !== null) {
    const selected = result.candidates[result.selectedIndex];
    console.log(
      `  Selected: ${selected.candidate.answer} (candidate #${result.selectedIndex + 1})`,
    );
  } else {
    console.log("  Selected: NONE — no candidate passed validation");
  }

  const feedErr = result.feedError ? `Feed error: ${result.feedError}` : null;
  const llmErr = result.llmError ? `LLM error: ${result.llmError}` : null;
  const errLine = [feedErr, llmErr].filter(Boolean).join("  |  ") || "none";
  console.log(`  Valid: ${validCount}/${total}   Errors: ${errLine}`);
  console.log();
}

async function main() {
  const opts = parsePreviewArgs();

  let systemPrompt: string | undefined;
  if (opts.promptFile) {
    const resolved = path.resolve(opts.promptFile);
    systemPrompt = await readFile(resolved, "utf-8");
    console.log(`Using custom prompt: ${opts.promptFile}`);
  }

  console.log(`\nGame generation — ${opts.dateKey}`);
  console.log(`Feed: ${opts.feedUrl ?? "https://realityblurred.com/realitytv/feed"}`);
  console.log(DIVIDER);

  const model = getConfiguredTextModel();
  // Always "file": even with no --prompt-file flag, generateCandidates falls
  // back to reading DEFAULT_GENERATION_PROMPT_PATH from disk — never a paste.
  const promptSource: "file" = "file";
  const promptPath = opts.promptFile ?? DEFAULT_GENERATION_PROMPT_PATH;
  const promptText =
    systemPrompt ?? getSystemPromptForGame({ systemPromptPath: DEFAULT_GENERATION_PROMPT_PATH });

  let runId: number | null = null;
  try {
    const [run] = await db
      .insert(generationRuns)
      .values({
        gamesTopicId: null,
        dateKey: opts.dateKey,
        status: "running",
        sourceMode: "rss",
        promptSource,
        promptPath,
        promptText,
        model,
        publishable: false,
        createdByHominemUserId: CLI_ACTOR,
        trigger: "cli",
        environment: detectRunEnvironment(),
      })
      .returning({ id: generationRuns.id });
    runId = run?.id ?? null;
  } catch (err) {
    console.error("Failed to record generation run:", err instanceof Error ? err.message : err);
  }

  const result = await generateCandidates(opts.dateKey, {
    feedUrl: opts.feedUrl,
    systemPrompt,
    model,
  });

  if (runId !== null) {
    try {
      await db
        .update(generationRuns)
        .set({
          status: result.llmError || result.feedError ? "failed" : "succeeded",
          selectedIndex: result.selectedIndex,
          feedError: result.feedError,
          llmError: result.llmError,
          feedItemCount: result.feedItemCount,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          reasoningTokens: result.usage.reasoningTokens,
          totalTokens: result.usage.totalTokens,
          costUsd: result.usage.costUsd,
          requestedMaxTokens: result.usage.requestedMaxTokens,
          finishedAt: new Date(),
        })
        .where(eq(generationRuns.id, runId));
    } catch (err) {
      console.error("Failed to update generation run:", err instanceof Error ? err.message : err);
    }
  }

  printFeedSection(result);
  printCandidatesSection(result);
  printResultSection(result);
}

if (!process.env.VITEST) await runScript(main);
