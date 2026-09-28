import { db, desc, gameEvents, gte } from "@pontistudios/db";

const REPORT_WINDOW_DAYS = 45;
const MAX_REPORT_EVENTS = 10_000;

export interface FunnelReportRow {
  topicSlug: string;
  source: string;
  starts: number;
  shares: number;
  wins: number;
  losses: number;
  guesses: number;
  clueUses: number;
  nextDayReturns: number;
  matureStarts: number;
}

export async function loadFunnelReport(now = new Date()): Promise<FunnelReportRow[]> {
  const cutoff = new Date(now.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await db
    .select({
      event: gameEvents.event,
      sessionId: gameEvents.sessionId,
      topicSlug: gameEvents.topicSlug,
      puzzleDate: gameEvents.puzzleDate,
      acquisitionSource: gameEvents.acquisitionSource,
      attemptCount: gameEvents.attemptCount,
      createdAt: gameEvents.createdAt,
    })
    .from(gameEvents)
    .where(gte(gameEvents.createdAt, cutoff))
    .orderBy(desc(gameEvents.createdAt))
    .limit(MAX_REPORT_EVENTS);

  const starts = events.filter((event) => event.event === "game_started");
  const startKeys = new Set(
    starts.map((event) => `${event.sessionId}|${event.topicSlug}|${event.puzzleDate}`),
  );
  const shareKeys = new Set<string>();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const groups = new Map<string, FunnelReportRow>();

  for (const event of events) {
    const source = event.acquisitionSource ?? "direct";
    const groupKey = `${event.topicSlug}|${source}`;
    let row = groups.get(groupKey);
    if (!row) {
      row = {
        topicSlug: event.topicSlug,
        source,
        starts: 0,
        shares: 0,
        wins: 0,
        losses: 0,
        guesses: 0,
        clueUses: 0,
        nextDayReturns: 0,
        matureStarts: 0,
      };
      groups.set(groupKey, row);
    }

    if (event.event === "game_started") {
      row.starts++;
      const date = new Date(`${event.puzzleDate}T00:00:00Z`);
      if (date < yesterday) {
        row.matureStarts++;
        date.setUTCDate(date.getUTCDate() + 1);
        const nextDate = date.toISOString().slice(0, 10);
        if (startKeys.has(`${event.sessionId}|${event.topicSlug}|${nextDate}`)) {
          row.nextDayReturns++;
        }
      }
    } else if (event.event === "shared") {
      const key = `${event.sessionId}|${event.topicSlug}|${event.puzzleDate}`;
      if (!shareKeys.has(key)) {
        row.shares++;
        shareKeys.add(key);
      }
    } else if (event.event === "game_won") {
      row.wins++;
      row.guesses += event.attemptCount;
    } else if (event.event === "game_lost") {
      row.losses++;
      row.guesses += event.attemptCount;
    }
    else if (event.event === "clue_used") row.clueUses++;
  }

  return [...groups.values()].sort((a, b) => a.topicSlug.localeCompare(b.topicSlug) || a.source.localeCompare(b.source));
}
