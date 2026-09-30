import { MetricCard } from "@ponti-studios/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData } from "react-router";

import { formatUsd } from "~/lib/admin/format";
import { loadAdminOverview } from "~/lib/admin/inventory";
import { loadAdminTopics } from "~/lib/admin/articles.server";
import { reapStaleGenerations } from "~/lib/admin/generate.server";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} admin` }, { name: "robots", content: "noindex" }];
}

export async function loader() {
  const topics = await loadAdminTopics();
  await reapStaleGenerations();
  const overviews = await Promise.all(
    topics.map((topic) => loadAdminOverview(topic.slug, new Date(), { reapStale: false })),
  );
  return { topics, overviews: overviews.filter((overview) => overview !== null) };
}

export default function GameAdminOverview() {
  const { topics, overviews } = useLoaderData<typeof loader>();
  const utcToday = overviews[0]?.utcToday ?? "—";
  const readyToday = overviews.filter((overview) => overview.todayPuzzlePresent).length;
  const inventoryDays = overviews.reduce((total, overview) => total + overview.inventoryDepth, 0);
  const pendingArticles = overviews.reduce((total, overview) => total + overview.pendingArticles, 0);
  const recentCost = overviews.reduce((total, overview) => total + overview.recentGenerationCostUsd, 0);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <header className="border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">All topics</h1>
        <p className="text-muted-foreground mt-2">Cross-topic readiness and content inventory · {utcToday} UTC</p>
      </header>

      <section aria-labelledby="pipeline-health-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="pipeline-health-heading" className="mt-1 text-xl font-semibold tracking-tight">
              Today across topics
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Topics ready today" value={`${readyToday} / ${overviews.length}`} />
          <MetricCard label="Inventory days" value={inventoryDays} />
          <MetricCard label="Pending articles" value={pendingArticles} />
          <MetricCard label="Recent run cost" value={formatUsd(recentCost)} />
        </div>
      </section>

      <section aria-label="Topic readiness" className="grid gap-4 md:grid-cols-2">
        {topics.map((topic) => {
          const overview = overviews.find((item) => item.game.slug === topic.slug);
          return (
            <Card key={topic.slug}>
              <CardHeader className="pb-3">
                <CardTitle><Link className="hover:underline" to={`/admin/topics/${topic.slug}`}>{topic.name}</Link></CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground block">Today</span>{overview?.todayPuzzlePresent ? "Ready" : "Missing"}</div>
                <div><span className="text-muted-foreground block">Pending articles</span>{topic.counts.pending}</div>
                <div><span className="text-muted-foreground block">Inventory days</span>{overview?.inventoryDepth ?? 0}</div>
                <div><span className="text-muted-foreground block">Recent cost</span>{formatUsd(overview?.recentGenerationCostUsd ?? 0)}</div>
                <div className="col-span-2 flex gap-3 border-t pt-3">
                  <Link className="text-primary underline-offset-4 hover:underline" to={`/admin/topics/${topic.slug}/articles`}>Articles</Link>
                  <Link className="text-primary underline-offset-4 hover:underline" to={`/admin/topics/${topic.slug}/create`}>Create puzzle</Link>
                  <Link className="text-primary underline-offset-4 hover:underline" to={`/admin/topics/${topic.slug}/schedule`}>Schedule</Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
