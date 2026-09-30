import { SectionIntro } from "@ponti-studios/ui/layout";
import { Input } from "@ponti-studios/ui/forms";
import { PaginationControls } from "@ponti-studios/ui/navigation";
import { Button } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, useSearchParams, type LoaderFunctionArgs } from "react-router";

import { loadAdminInventory, loadAdminRunHistory } from "~/lib/admin/inventory";
import { isDateKey } from "~/lib/puzzle/date";

import { GenerationsList, InventoryList } from "./admin.inventory-list";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} schedule` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });
  const view = url.searchParams.get("view") === "runs" ? "runs" : "dates";
  const dateKey = url.searchParams.get("date") ?? "";
  const statusValue = url.searchParams.get("status");
  const status =
    statusValue === "running" || statusValue === "succeeded" || statusValue === "failed"
      ? statusValue
      : undefined;
  const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const [inventory, history] = await Promise.all([
    loadAdminInventory(slug),
    loadAdminRunHistory(slug, { ...(isDateKey(dateKey) ? { dateKey } : {}), status, page }),
  ]);
  if (!inventory || !history) {
    throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  }
  return { inventory, history, view, dateKey, status: status ?? "all" };
}

export default function GameAdminInventory() {
  const { inventory, history, view, dateKey, status } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = 50;
  const filteredCells = inventory.cells.filter((cell) => cell.dateKey.includes(dateKey));
  const pageCount = Math.max(1, Math.ceil(filteredCells.length / pageSize));
  const currentDatePage = Math.min(
    Number.parseInt(searchParams.get("page") ?? "0", 10) || 0,
    pageCount - 1,
  );
  const datePageCells = filteredCells.slice(
    currentDatePage * pageSize,
    (currentDatePage + 1) * pageSize,
  );
  const totalPages = Math.max(1, Math.ceil(history.total / pageSize));

  function updatePage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionIntro title={view === "runs" ? "Generation history" : "Schedule"} />

      <div className="flex gap-2 border-b pb-3" aria-label="Schedule views">
        <Button asChild size="sm" variant={view === "dates" ? "default" : "outline"}>
          <Link to={`/admin/topics/${inventory.game.slug}/schedule`}>Puzzle dates</Link>
        </Button>
        <Button asChild size="sm" variant={view === "runs" ? "default" : "outline"}>
          <Link to={`/admin/topics/${inventory.game.slug}/schedule?view=runs`}>
            Generation history
          </Link>
        </Button>
      </div>

      {view === "runs" ? (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="game" value={inventory.game.slug} />
            <input type="hidden" name="view" value="runs" />
            <input type="hidden" name="status" value={status} />
            <label className="grid gap-1 text-sm">
              <span>Date</span>
              <Input type="date" name="date" defaultValue={dateKey} />
            </label>
            <Button type="submit" variant="outline">
              Filter by date
            </Button>
          </form>
          <div className="flex flex-wrap gap-2" aria-label="Filter runs by status">
            {(["all", "running", "succeeded", "failed"] as const).map((value) => {
              const params = new URLSearchParams(searchParams);
              if (value === "all") params.delete("status");
              else params.set("status", value);
              params.delete("page");
              return (
                <Button
                  key={value}
                  asChild
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                >
                  <Link to={`/admin/topics/${inventory.game.slug}/schedule?${params}`}>
                    {value === "all" ? "All drafts" : value[0].toUpperCase() + value.slice(1)}
                  </Link>
                </Button>
              );
            })}
          </div>
          <GenerationsList generations={history.generations} gameSlug={inventory.game.slug} />
          {history.total > pageSize ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">{history.total} drafts</p>
              <PaginationControls
                currentPage={history.page}
                totalPages={totalPages}
                onPageChange={updatePage}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <form method="get" className="flex max-w-xl gap-2">
            <input type="hidden" name="game" value={inventory.game.slug} />
            <Input
              name="date"
              type="search"
              aria-label="Filter dates"
              placeholder="Filter by date"
              defaultValue={dateKey}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <p className="text-muted-foreground text-sm">{filteredCells.length} dates</p>
          <InventoryList cells={datePageCells} gameSlug={inventory.game.slug} />
          {filteredCells.length > pageSize ? (
            <PaginationControls
              currentPage={currentDatePage}
              totalPages={pageCount}
              onPageChange={updatePage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
