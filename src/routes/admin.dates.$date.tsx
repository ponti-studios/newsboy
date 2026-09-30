import { EmptyState } from "@ponti-studios/ui/feedback";
import { SectionIntro } from "@ponti-studios/ui/layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { StatusBadge, type StatusBadgeConfig } from "~/components/primitives";

import { loadAdminDate } from "~/lib/admin/inventory";
import { isDateKey } from "~/lib/puzzle/date";

import { GenerationsList } from "./admin.inventory-list";

import { BRAND_NAME } from "~/config/brand";

const DATE_CLASS: Record<"live" | "scheduled", StatusBadgeConfig> = {
  live: { label: "Live", variant: "default" },
  scheduled: { label: "Not live", variant: "outline" },
};

const ARTICLE_STATUS: Record<string, StatusBadgeConfig> = {
  pending: { label: "Pending", variant: "outline" },
  used: { label: "Used", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "secondary" },
};

export function meta() {
  return [{ title: `${BRAND_NAME} date` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const dateKey = params.date;
  if (!dateKey || !isDateKey(dateKey)) {
    throw Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });
  const detail = await loadAdminDate(slug, dateKey);
  if (!detail)
    throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  return detail;
}

export default function GameAdminDate() {
  const detail = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-8">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to={`/admin/topics/${detail.game.slug}/schedule`}>← Schedule</Link>
      </Button>

      <SectionIntro
        title={detail.dateKey}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={detail.live ? "live" : "scheduled"} config={DATE_CLASS} />
            <Button asChild>
              <Link to={`/admin/topics/${detail.game.slug}/create?date=${detail.dateKey}`}>
                Create another puzzle
              </Link>
            </Button>
          </div>
        }
      />

      {detail.puzzle ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {detail.puzzle.answer} <Badge variant="outline">{detail.puzzle.answerType}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Clue</p>
              <p>{detail.puzzle.clue}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">Detail</p>
              <p>{detail.puzzle.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={detail.puzzle.article.url}
                className="text-primary underline-offset-4 hover:underline"
              >
                {detail.puzzle.article.title}
              </a>
              <StatusBadge status={detail.puzzle.article.status} config={ARTICLE_STATUS} />
              <Badge variant="secondary">{detail.puzzle.article.articleTextLength} chars</Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No published puzzle"
          description="This date has no published puzzle. Generate candidates, then publish."
          action={
            <Button asChild>
              <Link to={`/admin/topics/${detail.game.slug}/create?date=${detail.dateKey}`}>
                Create puzzle
              </Link>
            </Button>
          }
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Candidate history</h2>
        <GenerationsList generations={detail.generations} gameSlug={detail.game.slug} />
      </section>
    </div>
  );
}
