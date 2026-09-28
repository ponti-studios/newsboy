import { useCallback } from "react";

type GameEvent = "game_started" | "guess_made" | "game_won" | "game_lost" | "shared" | "clue_used";

function analyticsIdentity(): { sessionId: string; source: string | null } {
  const sessionKey = "newsboy:analytics:session";
  const sourceKey = "newsboy:analytics:source";
  let sessionId = window.localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.localStorage.setItem(sessionKey, sessionId);
  }

  let source = window.localStorage.getItem(sourceKey);
  if (!source) {
    const params = new URLSearchParams(window.location.search);
    source = params.get("src") ?? params.get("utm_source");
    if (source && /^[a-zA-Z0-9_-]{1,80}$/.test(source)) {
      window.localStorage.setItem(sourceKey, source);
    } else {
      source = null;
    }
  }
  return { sessionId, source };
}

export function useGameAnalytics(topicSlug: string, puzzleDate: string) {
  const track = useCallback(
    (event: GameEvent, attemptCount: number, clueCount: number, once = false) => {
      try {
        const identity = analyticsIdentity();
        const uniqueKey = `newsboy:analytics:${event}:${topicSlug}:${puzzleDate}`;
        if (once && window.localStorage.getItem(uniqueKey)) return;
        if (once) window.localStorage.setItem(uniqueKey, "1");
        void fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            sessionId: identity.sessionId,
            topicSlug,
            puzzleDate,
            attemptCount,
            clueCount,
            acquisitionSource: identity.source,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Storage or analytics transport failures never interrupt a game.
      }
    },
    [puzzleDate, topicSlug],
  );

  return { track };
}
