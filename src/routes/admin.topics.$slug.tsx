import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ponti-studios/ui/data-display";
import { EmptyState } from "@ponti-studios/ui/feedback";
import { SectionIntro } from "@ponti-studios/ui/layout";
import { Button } from "@ponti-studios/ui/primitives";
import { Input } from "@ponti-studios/ui/forms";
import { PaginationControls } from "@ponti-studios/ui/navigation";
import { StatusBadge, type StatusBadgeConfig } from "~/components/primitives";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { loadAdminTopicArticles, refreshTopicArticlesBySlug } from "~/lib/admin/articles.server";
import { getGameAdminActor } from "~/lib/admin/auth";
import {
  articleStatusValues,
  isArticleStatus,
  type ArticleStatus,
} from "~/lib/generation/article-status";

import { BRAND_NAME } from "~/config/brand";

const ARTICLE_STATUS: Record<ArticleStatus, StatusBadgeConfig> = {
  pending: { label: "Pending", variant: "outline" },
  used: { label: "Used", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "secondary" },
};

export function meta() {
  return [{ title: `${BRAND_NAME} articles` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });

  const statusParam = new URL(request.url).searchParams.get("status");
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const requestedPage = Number.parseInt(new URL(request.url).searchParams.get("page") ?? "0", 10);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const status = statusParam && isArticleStatus(statusParam) ? statusParam : undefined;
  const detail = await loadAdminTopicArticles(slug, { status, query, page });
  if (!detail) throw Response.json({ error: "Topic not found" }, { status: 404 });
  return { ...detail, status: status ?? "all", query };
}

export async function action({ params, context }: ActionFunctionArgs) {
  const auth = getGameAdminActor(context);
  const slug = params.slug ?? "";
  const result = await refreshTopicArticlesBySlug(slug, auth.userId);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return {
    ok: true as const,
    inserted: result.inserted,
    scanned: result.scanned,
    updated: result.updated,
    extracted: result.extracted,
    emptyBody: result.emptyBody,
    failed: result.failed,
    expired: result.expired,
  };
}

function formatPublishedAt(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function GameAdminTopicArticles() {
  const { topic, articles, status, query, total, page } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const data = fetcher.data;

  return (
    <div className="flex flex-col gap-8">
      <SectionIntro
        title={topic.name}
        actions={
          <fetcher.Form method="post">
            <Button type="submit" disabled={busy} isLoading={busy}>
              Refresh feed
            </Button>
          </fetcher.Form>
        }
      />

      {data && "ok" in data && data.ok ? (
        <p className="text-muted-foreground text-sm">
          Scanned {data.scanned} feed items · {data.inserted} new · {data.updated} repaired · {data.failed} fetch failures · {data.emptyBody} pages without readable text · {data.expired} expired.
        </p>
      ) : null}
      {data && "ok" in data && !data.ok ? (
        <p className="text-destructive text-sm">{data.error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["all", ...articleStatusValues] as const).map((value) => {
          const params = new URLSearchParams(searchParams);
          if (value === "all") params.delete("status");
          else params.set("status", value);
          params.delete("page");
          const href = `/admin/topics/${topic.slug}/articles${params.size ? `?${params}` : ""}`;
          const current = searchParams.get("status") ?? "all";
          const active = current === value || (value === "all" && status === "all");
          return (
            <Button key={value} asChild size="sm" variant={active ? "default" : "outline"}>
              <Link to={href}>{value}</Link>
            </Button>
          );
        })}
      </div>

      <form method="get" className="flex max-w-xl gap-2">
        {searchParams.get("status") ? <input type="hidden" name="status" value={status} /> : null}
        <Input
          name="q"
          type="search"
          defaultValue={query}
          aria-label="Search article titles and links"
          placeholder="Search article titles and links"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">{total} articles</p>

      {articles.length === 0 ? (
        <EmptyState
          title={query ? "No matching articles" : "No articles"}
          description={
            query
              ? "Try a different title or link."
              : "Refresh the feed to pull stories into this topic."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Article text</TableHead>
              <TableHead>
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell>
                  <a
                    href={article.url}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {article.title}
                  </a>
                </TableCell>
                <TableCell>
                  <StatusBadge status={article.status} config={ARTICLE_STATUS} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatPublishedAt(article.publishedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground" title={article.articleTextError ?? undefined}>
                  {article.articleTextLength > 0
                    ? `${article.articleTextLength} chars`
                    : `${article.articleTextStatus}${article.articleTextError ? ` · ${article.articleTextError}` : ""} · ${article.articleTextAttempts} attempts`}
                </TableCell>
                <TableCell className="text-right">
                  {article.status === "pending" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/admin/topics/${encodeURIComponent(topic.slug)}/create?articleId=${article.id}`}
                      >
                        Create puzzle
                      </Link>
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {total > 50 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {total} articles · page {page + 1}
          </p>
          <PaginationControls
            currentPage={page}
            totalPages={Math.ceil(total / 50)}
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String(nextPage));
              setSearchParams(next);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
