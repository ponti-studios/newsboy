import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { getConfiguredTextModel } from "@pontistudios/ai";
import { db, eq, generationRuns } from "@pontistudios/db";
import { detectRunEnvironment, generateCandidates } from "../src/lib/generation/generate.server";
import { getDateKey } from "../src/lib/puzzle/date";
import { PROMPT_TEST_CASES } from "../src/lib/values/prompt-test-cases";
import { readSourceCapture, type SourceCapture } from "../src/lib/values/source-captures";
import { runScript } from "./_shared/run-script";

const CLI_ACTOR = "cli:game-prompt-test";

type Options = {
  promptFiles: string[];
  dateKey: string;
  sourceFixtures: string[];
  model?: string;
  requireLiteralMatch: boolean;
};

function parseOptions(): Options {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "prompt-file": { type: "string", multiple: true },
      "date-key": { type: "string" },
      "source-fixture": { type: "string", multiple: true },
      model: { type: "string" },
      literal: { type: "boolean", default: false },
    },
    strict: true,
  });

  return {
    promptFiles: values["prompt-file"] ?? [],
    dateKey: values["date-key"] ?? getDateKey(new Date()),
    sourceFixtures: values["source-fixture"] ?? [],
    model: values.model,
    requireLiteralMatch: values.literal ?? false,
  };
}

function fixturePasses(
  fixture: (typeof PROMPT_TEST_CASES)[number],
  result: Awaited<ReturnType<typeof generateCandidates>>,
) {
  const selected = result.selectedIndex === null ? null : result.candidates[result.selectedIndex];
  const selectedAnswer = selected?.validation.answer;
  if (selectedAnswer && fixture.forbiddenAnswers?.includes(selectedAnswer)) return false;
  return (
    selected !== null &&
    selected !== undefined &&
    selectedAnswer !== undefined &&
    fixture.expectedAnswers.includes(selectedAnswer)
  );
}

async function recordRun(input: {
  dateKey: string;
  feedUrl: string;
  promptPath: string;
  promptText: string;
  model: string;
}): Promise<number | null> {
  try {
    const [run] = await db
      .insert(generationRuns)
      .values({
        gamesTopicId: null,
        dateKey: input.dateKey,
        status: "running",
        sourceMode: "fixtures",
        promptSource: "file",
        promptPath: input.promptPath,
        promptText: input.promptText,
        model: input.model,
        publishable: false,
        createdByHominemUserId: CLI_ACTOR,
        trigger: "cli",
        environment: detectRunEnvironment(),
      })
      .returning({ id: generationRuns.id });
    return run?.id ?? null;
  } catch (err) {
    console.error("Failed to record generation run:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function finishRun(
  runId: number | null,
  result: Awaited<ReturnType<typeof generateCandidates>>,
): Promise<void> {
  if (runId === null) return;
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

async function main() {
  const options = parseOptions();
  const promptFiles =
    options.promptFiles.length > 0
      ? options.promptFiles
      : ["src/prompts/game-generation.md"];
  const sourceFixtures = await Promise.all(
    options.sourceFixtures.map((fixturePath) => readSourceCapture(path.resolve(fixturePath))),
  );
  const fixtures: Array<(typeof PROMPT_TEST_CASES)[number] | SourceCapture> =
    sourceFixtures.length > 0 ? sourceFixtures : PROMPT_TEST_CASES;

  const model = options.model ?? getConfiguredTextModel();

  for (const promptFile of promptFiles) {
    const resolved = path.resolve(promptFile);
    const prompt = await readFile(resolved, "utf-8");
    let passed = 0;

    console.log(`\nPROMPT: ${promptFile}`);
    console.log("─".repeat(72));

    for (const fixture of fixtures) {
      const feedUrl =
        "sourceUrl" in fixture
          ? fixture.sourceUrl
          : `https://${fixture.sourceDomains[0]}/test-feed`;

      const runId = await recordRun({
        dateKey: options.dateKey,
        feedUrl,
        promptPath: promptFile,
        promptText: prompt,
        model,
      });

      const result = await generateCandidates(options.dateKey, {
        feedItems: "feedItems" in fixture ? fixture.feedItems : fixture.items,
        feedUrl,
        systemPrompt: prompt,
        model,
        requireLiteralMatch: options.requireLiteralMatch,
      });

      await finishRun(runId, result);

      const pass =
        "expectedAnswers" in fixture
          ? fixturePasses(fixture, result)
          : result.selectedIndex !== null;
      if (pass) passed++;
      const selected =
        result.selectedIndex === null
          ? "NONE"
          : (result.candidates[result.selectedIndex]?.candidate.answer ?? "NONE");
      console.log(
        `${pass ? "PASS" : "FAIL"} ${fixture.id.padEnd(38)} selected=${selected} valid=${result.candidates.filter((c) => c.validation.valid).length}/${result.candidates.length}`,
      );
      if (result.llmError) console.log(`  error=${result.llmError}`);
      for (const candidate of result.candidates) {
        console.log(
          `  ${candidate.candidate.answer}: ${candidate.validation.valid ? "valid" : candidate.validation.reasons.join("; ")}`,
        );
        console.log(
          `    about=${candidate.candidate.articleAbout ?? "—"} | concept=${candidate.candidate.concept ?? "—"} | meaning=${candidate.candidate.answerMeaning ?? "—"} | relationship=${candidate.candidate.relationship ?? "—"}`,
        );
      }
    }

    console.log(`Score: ${passed}/${fixtures.length}`);
  }
}

if (!process.env.VITEST) await runScript(main);
