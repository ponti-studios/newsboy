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
import { Link, useFetcher, useLoaderData, type ActionFunctionArgs } from "react-router";

import { loadAdminTopics, refreshTopicArticlesBySlug } from "~/lib/admin/articles.server";
import { getGameAdminActor } from "~/lib/admin/auth";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} topics` }, { name: "robots", content: "noindex" }];
}

export async function loader() {
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
          {data.inserted} new · {data.scanned} in feed · {data.expired} expired
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/admin">← Admin</Link>
      </Button>

      <SectionIntro
        title="Topics"
        description="Each topic has one feed. Refresh pulls new articles and expires stale pending ones."
      />

      {topics.length === 0 ? (
        <EmptyState
          title="No topics"
          description={`No active ${BRAND_NAME} topics are configured.`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Feed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell>
                  <Link
                    to={`/admin/topics/${topic.slug}`}
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
    </main>
  );
}
