import { useLoaderData } from "react-router";

import { loadFunnelReport } from "~/lib/data/analytics.server";
import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `Player funnel · ${BRAND_NAME} admin` }, { name: "robots", content: "noindex" }];
}

export async function loader() {
  return { rows: await loadFunnelReport(), windowDays: 45 };
}

export default function GameAnalyticsPage() {
  const { rows, windowDays } = useLoaderData<typeof loader>();

  return (
    <>
      <header className="mb-8 border-b pb-6">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          Game operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Player funnel</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Topic and first-touch source cohorts over the last {windowDays} days. Next-day return
          includes cohorts with at least one full day to return.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-sm">
          No game events have been recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-220 text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Starts</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Solve rate</th>
                <th className="px-4 py-3">Share rate</th>
                <th className="px-4 py-3">Next-day return</th>
                <th className="px-4 py-3">Avg guesses</th>
                <th className="px-4 py-3">Clue uses</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const completed = row.wins + row.losses;
                return (
                  <tr key={`${row.topicSlug}:${row.source}`}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {row.topicSlug}
                    </th>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 tabular-nums">{row.starts}</td>
                    <td className="px-4 py-3 tabular-nums">{completed}</td>
                    <td className="px-4 py-3 tabular-nums">{percent(row.wins, completed)}</td>
                    <td className="px-4 py-3 tabular-nums">{percent(row.shares, completed)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {percent(row.nextDayReturns, row.matureStarts)}
                      <span className="text-muted-foreground ml-1 text-xs">
                        {row.nextDayReturns}/{row.matureStarts}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {completed ? (row.guesses / completed).toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.clueUses}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground mt-4 text-xs">
        Events are anonymous and contain no answers, guess words, clue text, or referrer URLs.
      </p>
    </>
  );
}

function percent(numerator: number, denominator: number): string {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}
