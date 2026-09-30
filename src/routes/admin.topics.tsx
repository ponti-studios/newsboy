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
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { loadAdminTopics, refreshTopicArticlesBySlug } from "~/lib/admin/articles.server";
import { getGameAdminActor } from "~/lib/admin/auth";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} articles` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("game");
  if (slug) {
    url.searchParams.delete("game");
    return redirect(`/admin/topics/${slug}/articles${url.search}`);
  }
  return { topics: await loadAdminTopics() };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = getGameAdminActor(context);
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  const result = await refreshTopicArticlesBySlug(slug, auth.userId);
  if (!result.ok) {
    return { ok: false as const, error: result.error, slug };
  }
  return {
    ok: true as const,
    slug,
    inserted: result.inserted,
    scanned: result.scanned,
    updated: result.updated,
    failed: result.failed,
    emptyBody: result.emptyBody,
    expired: result.expired,
  };
}

function RefreshButton({ slug }: { slug: string }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const data = fetcher.data;

  return (
    <div className="flex flex-col items-end gap-1">
      <fetcher.Form method="post">
        <input type="hidden" name="slug" value={slug} />
        <Button type="submit" size="sm" variant="outline" disabled={busy} isLoading={busy}>
          Refresh
        </Button>
      </fetcher.Form>
      {data && "ok" in data && data.ok && data.slug === slug ? (
        <p className="text-muted-foreground text-xs">
          {data.inserted} new · {data.updated} repaired · {data.scanned} scanned · {data.failed}{" "}
          failed · {data.emptyBody} unreadable · {data.expired} expired
        </p>
      ) : null}
      {data && "ok" in data && !data.ok ? (
        <p className="text-destructive text-xs">{data.error}</p>
      ) : null}
    </div>
  );
}

export default function GameAdminTopics() {
  const { topics } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-8">
      <SectionIntro title="Articles" />

      {topics.length === 0 ? (
        <EmptyState
          title="No article sources"
          description={`No active ${BRAND_NAME} games have article feeds configured.`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Source</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell>
                  <Link
                    to={`/admin/topics/${topic.slug}/articles?status=pending`}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {topic.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{topic.counts.pending}</TableCell>
                <TableCell className="text-muted-foreground">{topic.counts.used}</TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {topic.feedLabel}
                </TableCell>
                <TableCell>
                  <RefreshButton slug={topic.slug} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
