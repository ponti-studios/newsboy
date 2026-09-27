import { useEffect, useRef, useState } from "react";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import {
  GENERATION_PROMPT_FILES,
  type GenerateErr,
  type GenerateOk,
  type GenerateProgressEvent,
} from "~/lib/admin/generate-types";
import { studioModelAllowlist } from "~/lib/admin/generate.server";
import { resolveAdminGame } from "~/lib/admin/inventory";
import { getPendingArticlesForTopics } from "~/lib/data/articles.server";
import { getActiveGames } from "~/lib/data/games.server";
import { getActiveAdminGenerationRun } from "~/lib/data/generation-runs.server";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";
import { MAX_FEED_TITLE_LENGTH, sanitizeFeedText } from "~/lib/generation/feed-text";
import { getDateKey } from "~/lib/puzzle/date";
import { PROMPT_TEST_CASES } from "~/lib/values/prompt-test-cases";

import { GenerateForm } from "~/components/admin/generate-form";
import { GenerateProgress } from "~/components/admin/generate-progress";
import { GenerateResult } from "~/components/admin/generate-result";
import { subscribeToGenerateStream } from "~/components/admin/generate-stream";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} generate` }, { name: "robots", content: "noindex" }];
}

function isGenerateErr(value: unknown): value is GenerateErr {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function isStartedResponse(value: unknown): value is { ok: true; runId: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok?: unknown }).ok === true &&
    Number.isInteger((value as { runId?: unknown }).runId)
  );
}

function unexpectedResponseError(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { error?: unknown }).error === "string"
  ) {
    return `The server rejected the request (HTTP ${status}): ${(body as { error: string }).error}`;
  }
  return `The server rejected the request (HTTP ${status}).`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const game = await resolveAdminGame(slug);
  if (!game) throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  const topics = await getActiveGames();
  const [pendingArticles, activeRun] = await Promise.all([
    getPendingArticlesForTopics(
      topics.map((topic) => topic.id),
      200,
    ),
    getActiveAdminGenerationRun(game.id),
  ]);

  return {
    game: { id: game.id, slug: game.slug, name: game.name },
    dateKey: getDateKey(new Date()),
    models: studioModelAllowlist(),
    promptFiles: GENERATION_PROMPT_FILES,
    topics: topics.map((topic) => ({ id: topic.id, slug: topic.slug, name: topic.name })),
    articles: pendingArticles.map((article) => ({
      id: article.id,
      topicId: article.gamesTopicId,
      title: sanitizeFeedText(article.title, MAX_FEED_TITLE_LENGTH),
    })),
    fixtures: PROMPT_TEST_CASES.map((fixture) => fixture.id),
    activeRunId: activeRun?.id ?? null,
  };
}

export default function GameAdminGenerate() {
  const data = useLoaderData<typeof loader>();
  const [running, setRunning] = useState(data.activeRunId !== null);
  const [stage, setStage] = useState<GenerateProgressEvent | null>(null);
  const [result, setResult] = useState<GenerateOk | GenerateErr | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  function watch(runId: number) {
    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToGenerateStream(
      runId,
      data.game.slug,
      setStage,
      (finalResult) => {
        setResult(finalResult);
        setRunning(false);
      },
    );
  }

  // Resume watching a run that was already in progress when this page loaded
  // (e.g. the admin reloaded, or navigated back to it) — the run itself
  // never depended on this component being mounted.
  useEffect(() => {
    if (data.activeRunId !== null) {
      setRunning(true);
      setStage({
        type: "stage",
        stage: "model",
        label: "Still working",
        detail: "Reconnecting to a generation already in progress.",
      });
      watch(data.activeRunId);
    }
    return () => unsubscribeRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.activeRunId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRunning(true);
    setResult(null);
    setStage({
      type: "stage",
      stage: "prepare",
      label: "Checking the request",
      detail: "Sending the generation to the server.",
    });

    try {
      const response = await fetch("/admin/generate/events", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      // The action only ever returns `{ ok: true, runId }` or a `GenerateErr`,
      // but proxies and auth layers can interpose other shapes (403 JSON, an
      // error page, …). Validate before handing anything to the UI.
      const body: unknown = await response.json().catch(() => null);
      if (!isGenerateErr(body) && !isStartedResponse(body)) {
        setResult({
          ok: false,
          code: "INVALID_SOURCE",
          error: unexpectedResponseError(body, response.status),
        });
        setRunning(false);
        return;
      }
      const started = body;
      if (!started.ok) {
        setResult(started);
        setRunning(false);
        return;
      }
      watch(started.runId);
    } catch (error) {
      setResult({
        ok: false,
        code: "INVALID_SOURCE",
        error: error instanceof Error ? error.message : "Generation failed",
      });
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      {running ? (
        <GenerateProgress running failed={false} stage={stage} />
      ) : result ? (
        <GenerateResult result={result} gameSlug={data.game.slug} />
      ) : (
        <GenerateForm
          data={{
            gameSlug: data.game.slug,
            dateKey: data.dateKey,
            models: data.models,
            promptFiles: data.promptFiles,
            topics: data.topics,
            articles: data.articles,
            fixtures: data.fixtures,
          }}
          onSubmit={onSubmit}
        />
      )}
    </main>
  );
}
