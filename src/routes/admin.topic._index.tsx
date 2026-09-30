import { MetricCard } from "@ponti-studios/ui/data-display";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { formatUsd } from "~/lib/admin/format";
import { loadAdminOverview } from "~/lib/admin/inventory";

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });
  const overview = await loadAdminOverview(slug);
  if (!overview) throw Response.json({ error: "Topic not found" }, { status: 404 });
  return overview;
}

export default function AdminTopicOverview() {
  const overview = useLoaderData<typeof loader>();
  const base = `/admin/topics/${overview.game.slug}`;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div><h2 className="text-3xl font-semibold tracking-tight">{overview.game.name}</h2>
          <p className="text-muted-foreground mt-2">Readiness · {overview.utcToday} UTC</p></div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to={`${base}/articles`}>Find articles</Link></Button>
          <Button asChild><Link to={`${base}/create?date=${overview.utcToday}`}>Create puzzle</Link></Button>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Topic readiness">
        <MetricCard label="Days with puzzles" value={overview.inventoryDepth} />
        <MetricCard label="Unused articles" value={overview.pendingArticles} />
        <MetricCard label="Today’s puzzle · UTC" value={overview.todayPuzzlePresent ? "Ready" : "Missing"} />
        <MetricCard label="Recent run cost" value={formatUsd(overview.recentGenerationCostUsd)} />
      </section>
      <Card>
        <CardHeader className="border-b"><CardTitle>Recent drafts</CardTitle></CardHeader>
        <CardContent className="p-4">
          {overview.generations.length ? overview.generations.map((run) => (
            <div key={run.id} className="flex justify-between border-b py-2 text-sm last:border-0">
              <Link className="text-primary hover:underline" to={`${base}/generations/${run.id}`}>Generation {run.id} · {run.dateKey}</Link>
              <span className="text-muted-foreground">{run.status} · {formatUsd(run.costUsd ?? 0)}</span>
            </div>
          )) : <p className="text-muted-foreground text-sm">No recent drafts.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
