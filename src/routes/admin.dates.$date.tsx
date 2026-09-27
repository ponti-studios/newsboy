import { EmptyState } from "@ponti-studios/ui/feedback";
import { SectionIntro } from "@ponti-studios/ui/layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { StatusBadge, type StatusBadgeConfig } from "~/components/primitives";

import { loadAdminDate } from "~/lib/admin/inventory";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";
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

export async function loader({ request, params }: LoaderFunctionArgs) {
  const dateKey = params.date;
  if (!dateKey || !isDateKey(dateKey)) {
    throw Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const detail = await loadAdminDate(slug, dateKey);
  if (!detail)
    throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  return detail;
}

export default function GameAdminDate() {
  const detail = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to={`/admin?game=${detail.game.slug}`}>← Inventory</Link>
      </Button>

      <SectionIntro
        eyebrow={detail.game.name}
        title={detail.dateKey}
        description={
          detail.puzzle
            ? `Published puzzle · ${detail.playerCount} player${detail.playerCount === 1 ? "" : "s"} started this day`
            : `No published puzzle · ${detail.playerCount} player${detail.playerCount === 1 ? "" : "s"} started this day`
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={detail.live ? "live" : "scheduled"} config={DATE_CLASS} />
            <Button asChild>
              <Link to={`/admin/generate?game=${detail.game.slug}`}>Generate</Link>
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
            <CardDescription>
              Prompt {detail.puzzle.promptPath ?? "unknown"} · model{" "}
              {detail.puzzle.model ?? "unknown"}
            </CardDescription>
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
              <Link to={`/admin/generate?game=${detail.game.slug}`}>Generate</Link>
            </Button>
          }
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Generations</h2>
        <GenerationsList generations={detail.generations} gameSlug={detail.game.slug} />
      </section>
    </main>
  );
}
