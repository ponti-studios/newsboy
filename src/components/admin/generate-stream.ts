import type { GenerateErr, GenerateOk, GenerateProgressEvent } from "~/lib/admin/generate-types";

type GenerateStreamEvent =
  | GenerateProgressEvent
  | { type: "result"; result: GenerateOk | GenerateErr };

/**
 * Live progress for a generation run over Server-Sent Events. The run itself
 * already started server-side and keeps going regardless of this
 * connection — closing the tab, navigating away, or a dropped connection
 * doesn't stop it, and reconnecting (a fresh call with the same runId) picks
 * up wherever the run currently is instead of losing everything.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToGenerateStream(
  runId: number,
  gameSlug: string,
  onStage: (event: GenerateProgressEvent) => void,
  onResult: (result: GenerateOk | GenerateErr) => void,
): () => void {
  const source = new EventSource(
    `/admin/generate/stream?runId=${runId}&game=${encodeURIComponent(gameSlug)}`,
  );

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data) as GenerateStreamEvent;
    if (payload.type === "stage") onStage(payload);
    if (payload.type === "result") {
      onResult(payload.result);
      source.close();
    }
  };

  source.onerror = () => {
    // EventSource retries transient network errors on its own; only surface
    // a failure once the browser has given up and actually closed it.
    if (source.readyState === EventSource.CLOSED) {
      onResult({ ok: false, code: "INVALID_SOURCE", error: "Lost connection to the server." });
    }
  };

  return () => source.close();
}
