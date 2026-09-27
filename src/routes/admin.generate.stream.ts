import type { LoaderFunctionArgs } from "react-router";

import { BRAND_NAME } from "~/config/brand";
import { loadAdminGeneration, resolveAdminGame, toGenerateOk } from "~/lib/admin/inventory";
import {
  subscribeToGeneration,
  type GenerationStreamEvent,
} from "~/lib/admin/generation-events.server";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";
import { db, eq, generationRuns } from "@pontistudios/db";

/**
 * Fallback safety net for the in-memory bus: if the process that started the
 * run restarted (deploy, dev-server HMR, crash), no subscriber will ever
 * fire again — so also poll the DB. Whichever signals completion first wins.
 */
const POLL_MS = 4000;

async function terminalResultEvent(
  slug: string,
  runId: number,
): Promise<{ type: "result"; result: unknown }> {
  const detail = await loadAdminGeneration(slug, runId);
  return {
    type: "result",
    result: detail
      ? toGenerateOk(detail.generation)
      : { ok: false, code: "INVALID_SOURCE", error: "Generation not found" },
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const runId = Number.parseInt(url.searchParams.get("runId") ?? "", 10);
  if (!Number.isInteger(runId) || runId < 1) {
    return Response.json({ error: "Invalid runId" }, { status: 400 });
  }

  const game = await resolveAdminGame(slug);
  if (!game)
    return Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: GenerationStreamEvent | { type: "result"; result: unknown }) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const finish = (payload: GenerationStreamEvent | { type: "result"; result: unknown }) => {
        if (closed) {
          unsubscribe?.();
          if (pollTimer) clearInterval(pollTimer);
          return;
        }
        send(payload);
        closed = true;
        unsubscribe?.();
        if (pollTimer) clearInterval(pollTimer);
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting
        }
      };

      const [row] = await db
        .select({ status: generationRuns.status })
        .from(generationRuns)
        .where(eq(generationRuns.id, runId))
        .limit(1);

      if (!row) {
        finish({
          type: "result",
          result: { ok: false, code: "INVALID_SOURCE", error: "Generation not found" },
        });
        return;
      }

      if (row.status !== "running") {
        finish(await terminalResultEvent(slug, runId));
        return;
      }

      // Reconnect UX: tell the client we're caught up on an in-progress run
      // without pretending to know its exact stage history.
      send({
        type: "stage",
        stage: "model",
        label: "Still working",
        detail: "Watching this generation.",
      });

      unsubscribe = subscribeToGeneration(runId, (event) => {
        send(event);
        if (event.type === "stage" && event.stage === "done") {
          void terminalResultEvent(slug, runId).then(finish);
        }
      });

      pollTimer = setInterval(() => {
        void (async () => {
          const [current] = await db
            .select({ status: generationRuns.status })
            .from(generationRuns)
            .where(eq(generationRuns.id, runId))
            .limit(1);
          if (current && current.status !== "running") {
            finish(await terminalResultEvent(slug, runId));
          }
        })();
      }, POLL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe?.();
        if (pollTimer) clearInterval(pollTimer);
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (pollTimer) clearInterval(pollTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
