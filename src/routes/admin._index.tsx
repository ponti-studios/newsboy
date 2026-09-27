import { MetricCard } from "@ponti-studios/ui/data-display";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { formatUsd } from "~/lib/admin/format";
import { loadAdminOverview } from "~/lib/admin/inventory";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";

import { GenerationsList, InventoryList } from "./admin.inventory-list";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const overview = await loadAdminOverview(slug);
  if (!overview) {
    throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  }
  return overview;
}

export default function GameAdminOverview() {
  const overview = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-8 lg:gap-10">
        <header className="border-b pb-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                Game operations
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {overview.game.name}
              </h1>
              <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base">
                Monitor the article pipeline, published inventory, and model runs for this game.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/admin/topics">Articles</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/admin/costs">Costs</Link>
              </Button>
              <Button asChild>
                <Link to={`/admin/generate?game=${overview.game.slug}`}>Generate</Link>
              </Button>
            </div>
          </div>

          <dl className="mt-8 grid max-w-xl grid-cols-2 gap-3 text-sm sm:gap-6">
            <div>
              <dt className="text-muted-foreground text-xs">UTC today</dt>
              <dd className="mt-1 font-medium">{overview.utcToday}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Pacific today</dt>
              <dd className="mt-1 font-medium">{overview.pacificToday}</dd>
            </div>
          </dl>
        </header>

        <section aria-labelledby="pipeline-health-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                Snapshot
              </p>
              <h2
                id="pipeline-health-heading"
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                Pipeline health
              </h2>
            </div>
            <span className="text-muted-foreground hidden text-sm sm:block">
              Live inventory signals
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Inventory depth" value={overview.inventoryDepth} />
            <MetricCard label="Pending articles" value={overview.pendingArticles} />
            <MetricCard
              label="UTC today puzzle"
              value={overview.todayPuzzlePresent ? "Ready" : "Missing"}
            />
            <MetricCard
              label="Recent generation cost"
              value={formatUsd(overview.recentGenerationCostUsd)}
            />
          </div>
        </section>

        <section aria-labelledby="inventory-heading">
          <Card className="overflow-hidden">
            <CardHeader className="border-b sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                  Published schedule
                </p>
                <CardTitle id="inventory-heading" className="mt-1">
                  Inventory
                </CardTitle>
                <CardDescription className="mt-1">
                  Published puzzles and their player activity by date.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link to={`/admin/inventory?game=${overview.game.slug}`}>View all dates</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <InventoryList cells={overview.cells} gameSlug={overview.game.slug} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="generations-heading">
          <Card className="overflow-hidden">
            <CardHeader className="border-b sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                  Model activity
                </p>
                <CardTitle id="generations-heading" className="mt-1">
                  Generations
                </CardTitle>
                <CardDescription className="mt-1">
                  Recent attempts, source material, and usage for each date.
                </CardDescription>
              </div>
              <span className="text-muted-foreground text-sm">
                {overview.generations.length} recent{" "}
                {overview.generations.length === 1 ? "run" : "runs"}
              </span>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <GenerationsList generations={overview.generations} gameSlug={overview.game.slug} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
