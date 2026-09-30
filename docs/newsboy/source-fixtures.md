---
title: Source Fixtures
summary: How to capture offline RSS/article snapshots for prompt testing without live feeds.
type: guide
status: active
owner: charlesponti
tags: [generation, testing, fixtures]
related: [./prompt-evaluation.md, ./candidate-generation.md]
updated: 2026-09-10
---

# Source Fixtures

Capture real feed snapshots once, offline, and reuse them for prompt
benchmarking. Commands run from `packages/newsboy` (they are not exposed at the
repo root):

```bash
cd packages/newsboy

# Capture all four fixture feeds (20 items each by default)
pnpm game:capture-fixtures

# Refresh a single feed with a different cap
pnpm game:capture-fixtures --feed=tech-news --limit=50
```

`game:capture-fixtures` (`scripts/game-capture-fixtures.ts`) stores bounded RSS
metadata plus Readability-extracted article text in
`src/lib/values/sources/<id>.json`. Feed ids are `tech-news`, `page-six`,
`tmz`, `sports-news`; `--limit` defaults to 20; `--out-dir` defaults to
`src/lib/values/sources`. It never writes to the database.

Run the prompt benchmark against snapshots instead of live feeds:

```bash
pnpm newsboy:prompt-test \
  --source-fixture=src/lib/values/sources/tech-news.json \
  --source-fixture=src/lib/values/sources/page-six.json
```

Fixtures are bounded snapshots, not permanent archives. They are useful for
testing source grounding, answer validity, leakage, prompt-injection handling,
and candidate ranking. The curated cases in `src/lib/values/prompt-test-cases.ts`
(with `expectedAnswers`/`forbiddenAnswers`) remain the correctness benchmark —
real snapshots need editorial labeling before they can assert a specific
answer.