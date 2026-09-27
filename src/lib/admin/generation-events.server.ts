import type { GenerateErr, GenerateOk, GenerateProgressEvent } from "./generate-types";

export type GenerationStreamEvent =
  | GenerateProgressEvent
  | { type: "result"; result: GenerateOk | GenerateErr };

type Listener = (event: GenerationStreamEvent) => void;

/**
 * In-process pub/sub keyed by generation run id. No Redis: this app runs as a
 * single process, so an in-memory bus is sufficient — the SSE route also
 * polls the DB as a fallback for the case where a subscriber's process
 * restarted (deploy, crash) mid-run, so nothing here needs to survive that.
 * Stored on globalThis so it survives Vite HMR module reloads in dev.
 *
 * This ONLY works because there is exactly one server process. If this app
 * is ever deployed with more than one replica, publishGenerationEvent calls
 * made in one process will never reach a subscriber in another — live
 * per-stage progress would go silent for cross-process pairs (the DB poll
 * fallback still delivers the final success/failure outcome within its
 * polling interval, so no result is lost, just the intermediate updates).
 */
type GlobalBus = typeof globalThis & {
  __gameGenerationBus?: Map<number, Set<Listener>>;
};

const globalBus = globalThis as GlobalBus;
const listeners = globalBus.__gameGenerationBus ?? new Map<number, Set<Listener>>();
globalBus.__gameGenerationBus = listeners;

export function publishGenerationEvent(runId: number, event: GenerationStreamEvent): void {
  const set = listeners.get(runId);
  if (!set) return;
  for (const listener of set) listener(event);
}

/** Returns an unsubscribe function. */
export function subscribeToGeneration(runId: number, listener: Listener): () => void {
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(runId);
  };
}
