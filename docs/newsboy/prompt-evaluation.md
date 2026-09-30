---
title: Prompt Evaluation
summary: How to benchmark a generation prompt against fixed article fixtures before promoting it.
type: guide
status: active
owner: charlesponti
tags: [generation, llm, testing]
related: [./candidate-generation.md, ./source-fixtures.md]
updated: 2026-09-10
---

# Prompt Evaluation

The prompt benchmark compares prompt files against the same fixed article
fixtures (`src/lib/values/sources/*.json`) and curated cases
(`src/lib/values/prompt-test-cases.ts`). It is intentionally opt-in because it
makes live OpenRouter calls. Run from `packages/newsboy`:

```bash
cd packages/newsboy

# Built-in comparison (curated cases + source fixtures)
pnpm newsboy:prompt-test

# Compare custom prompt files
pnpm newsboy:prompt-test \
  --prompt-file=src/prompts/game-generation.md \
  --prompt-file=./my-prompt-v2.md

# Override the model for a run without mutating env
pnpm newsboy:prompt-test --model=openai/gpt-5-mini
```

Flags (`scripts/game-prompt-test.ts`): `--prompt-file` (repeatable),
`--source-fixture` (repeatable), `--model`, `--date-key` (defaults to today).

The score measures whether the first selected valid answer is in the fixture's
acceptable answer set and not in any fixture-specific `forbiddenAnswers` list;
the `valid` count is a secondary signal for how many candidates survive
dictionary, length, leakage, safety, and source checks. A higher score is not
enough by itself — inspect candidate wording and source grounding before
promoting a prompt.

Add a fixture when a production failure reveals a new genre or failure mode,
and keep acceptable answers deliberately broad only when multiple words are
genuinely fair. Use `forbiddenAnswers` for attractive-but-wrong answers that a
regression must not select (for example, an incidental-object association such
as `MUGGY`).
