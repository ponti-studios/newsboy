import { SectionIntro } from "@ponti-studios/ui/layout";
import {
  redirect,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { StatusBadge, type StatusBadgeConfig } from "~/components/primitives";

import { getGameAdminActor } from "~/lib/admin/auth";
import { formatTokenCount, formatUsd } from "~/lib/admin/format";
import { loadAdminGeneration, resolveAdminGame } from "~/lib/admin/inventory";
import { publishCandidate } from "~/lib/admin/publish";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";

import { CandidateCards } from "~/components/admin/candidate-cards";

import { BRAND_NAME } from "~/config/brand";

const GENERATION_STATUS: Record<"running" | "succeeded" | "failed", StatusBadgeConfig> = {
  running: { label: "Running", variant: "outline" },
  succeeded: { label: "Succeeded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function meta() {
  return [{ title: `${BRAND_NAME} generation` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const generationId = Number.parseInt(params.id ?? "", 10);
  if (!Number.isInteger(generationId) || generationId < 1) {
    throw Response.json({ error: "Invalid generation" }, { status: 400 });
  }

  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const detail = await loadAdminGeneration(slug, generationId);
  if (!detail) throw Response.json({ error: "Generation not found" }, { status: 404 });
  return detail;
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const auth = getGameAdminActor(context);
  const generationId = Number.parseInt(params.id ?? "", 10);
  const form = await request.formData();
  const candidateId = Number.parseInt(String(form.get("candidateId") ?? ""), 10);
  if (!Number.isInteger(generationId) || !Number.isInteger(candidateId)) {
    return Response.json({ ok: false as const, error: "Invalid publish request" }, { status: 400 });
  }

  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const game = await resolveAdminGame(slug);
  if (!game)
    return Response.json({ ok: false as const, error: "Topic not found" }, { status: 404 });

  const result = await publishCandidate({
    game,
    generationId,
    candidateId,
    userId: auth.userId,
  });
  if (!result.ok) {
    return Response.json({ ok: false as const, error: result.error }, { status: 400 });
  }
  return redirect(`/admin/dates/${result.dateKey}?game=${game.slug}`);
}

export default function GameAdminGeneration() {
  const { game, generation } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-6">
      <SectionIntro title={`Generation ${generation.id}`} />

      <dl className="border-muted-foreground bg-card space-y-2 rounded-md border p-2 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <dt className="font-semibold">Status</dt>
          <dd className="font-light">
            <StatusBadge status={generation.status} config={GENERATION_STATUS} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Date</dt>
          <dd className="font-light">{generation.dateKey}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Source mode</dt>
          <dd className="font-light">{generation.sourceMode}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Model</dt>
          <dd className="font-light">{generation.model}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Max tokens</dt>
          <dd className="font-light">{generation.requestedMaxTokens ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Reasoning effort</dt>
          <dd className="font-light">{generation.reasoningEffort ?? "default"}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Tokens (prompt / reasoning / output)</dt>
          <dd className="text-right font-light">
            {formatTokenCount(generation.promptTokens)} /{" "}
            {formatTokenCount(generation.reasoningTokens)} /{" "}
            {formatTokenCount(generation.completionTokens)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="font-semibold">Cost</dt>
          <dd className="font-light">{formatUsd(generation.costUsd)}</dd>
        </div>
      </dl>

      <CandidateCards
        candidates={generation.candidates}
        generationId={generation.id}
        gameSlug={game.slug}
        publishable={generation.publishable}
      />
    </main>
  );
}
