---
title: "Task: per-topic share/OG images"
summary: Dynamic, spoiler-free share-card images per topic and result, for richer link unfurls on the existing share flow.
type: task
status: proposed
owner: charlesponti
tags: [growth, frontend, backend]
related: [../gameplay-and-ux.md, ../launch-plan.md]
updated: 2026-09-29
---

# Task: per-topic share/OG images

## Why

The existing share flow (`src/lib/player/share.ts`, `src/hooks/use-share.ts`)
already produces a spoiler-free emoji-grid text share. A matching dynamic
share-card image would make link unfurls (iMessage, Twitter/X, Slack, etc.)
richer without changing the underlying sharing mechanic, which the launch
plan requires to stay "attributed links only" — this doesn't add embeds or
subscriptions, just a better-looking link preview.

## Scope

- A server-rendered image (topic branding/color + the emoji-grid result, or
  a simpler topic-only card if a per-result image is too costly to justify
  first) served at a stable, cacheable URL.
- Wire it into `<meta property="og:image">` / `twitter:image` for the
  relevant route(s).

## Implementation notes

- `src/routes/topic.tsx` and `src/routes/topic.$dateKey.tsx` currently have
  no `meta()` export — this task needs to add one, following the existing
  `meta()` pattern already used elsewhere (e.g.
  `src/routes/admin.generate.tsx`).
- **Must stay spoiler-free**: page metadata is fetched by link-preview
  crawlers before any player interaction, so it can never encode the day's
  answer — only topic branding for the default card. A per-result card
  (with the emoji grid) can only be generated for the sharing player's own
  result, not embedded in the page's own static meta tags, to avoid leaking
  today's result to a crawler that isn't the sharing player. This likely
  means: static per-topic OG image in page `<meta>`, and a separate
  per-result image only generated into the URL the player actually shares
  (e.g. `shareUrl` in `buildGameShareText`), not into the page's default
  metadata.
- Reuse `getTopicEmoji` / topic branding (`lib/generation/catalog.ts`) so the
  image matches the emoji tiles already used in share text, rather than
  introducing a second color/branding source of truth.
- Consider an edge-cacheable image route (SVG-to-PNG or a canvas-based
  renderer) rather than a heavyweight headless-browser screenshot pipeline,
  given this is a small enhancement, not a core feature.

## Acceptance criteria

- Sharing a link produces a rich preview with topic branding in supported
  clients (iMessage, Slack, Twitter/X at minimum).
- No image or metadata anywhere in the unauthenticated page response reveals
  the day's answer or clue.
- Image generation does not add meaningful latency to the base page load
  (served from a separate, cacheable route).

## Out of scope

- Per-result images embedded directly in crawlable page metadata (spoiler
  risk, see above).
- Video/animated share cards.
