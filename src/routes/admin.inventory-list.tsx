import { EmptyState } from "@ponti-studios/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ponti-studios/ui/data-display";
import { StatusBadge, type StatusBadgeConfig } from "~/components/primitives";
import { Link } from "react-router";

import { formatTokenCount, formatUsd } from "~/lib/admin/format";
import type { AdminGeneration, InventoryCell, InventoryCellState } from "~/lib/admin/inventory";

export const CELL_STATUS: Record<InventoryCellState, StatusBadgeConfig> = {
  live: { label: "Live", variant: "default" },
  ready: { label: "Ready", variant: "outline" },
  missing: { label: "Missing", variant: "secondary" },
};

const GENERATION_STATUS: Record<AdminGeneration["status"], StatusBadgeConfig> = {
  running: { label: "Running", variant: "outline" },
  succeeded: { label: "Succeeded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const ERROR_LABELS: Record<string, string> = {
  reaped: "Timed out — no response after 10+ minutes",
};

function friendlyError(llmError: string): string {
  return ERROR_LABELS[llmError] ?? llmError;
}

function cellWhen(cell: InventoryCell) {
  if (cell.isUtcToday) return "UTC today";
  if (cell.isPacificToday) return "PT today";
  return "Scheduled";
}

export function InventoryList({ cells, gameSlug }: { cells: InventoryCell[]; gameSlug: string }) {
  if (cells.length === 0) {
    return (
      <EmptyState title="No inventory dates" description="There are no dates in this window." />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>When</TableHead>
          <TableHead>Players</TableHead>
          <TableHead>Puzzle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cells.map((cell) => (
          <TableRow key={cell.dateKey}>
            <TableCell>
              <Link
                to={`/admin/dates/${cell.dateKey}?game=${gameSlug}`}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {cell.dateKey}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{cellWhen(cell)}</TableCell>
            <TableCell className="text-muted-foreground">{cell.attemptCount}</TableCell>
            <TableCell>
              <StatusBadge status={cell.state} config={CELL_STATUS} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function GenerationsList({
  generations,
  gameSlug,
}: {
  generations: AdminGeneration[];
  gameSlug: string;
}) {
  if (generations.length === 0) {
    return (
      <EmptyState
        title="No generations"
        description="Generate candidates for a date. A generation is not a player, and it is not the published puzzle."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {generations.map((generation) => (
          <GenerationCard key={generation.id} generation={generation} gameSlug={gameSlug} />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">When</TableHead>
              <TableHead className="w-[118px]">Date</TableHead>
              <TableHead className="min-w-[250px]">Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="min-w-[170px]">Model</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generations.map((generation) => (
              <GenerationRow key={generation.id} generation={generation} gameSlug={gameSlug} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function GenerationRow({
  generation,
  gameSlug,
}: {
  generation: AdminGeneration;
  gameSlug: string;
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap align-top">
        <Link
          to={`/admin/generations/${generation.id}?game=${gameSlug}`}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          {formatGenerationTime(generation.createdAt)}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap align-top">
        <Link
          to={`/admin/dates/${generation.dateKey}?game=${gameSlug}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {generation.dateKey}
        </Link>
      </TableCell>
      <TableCell className="align-top">
        <GenerationStatus generation={generation} />
      </TableCell>
      <TableCell className="text-muted-foreground align-top whitespace-nowrap">
        <span>{generation.sourceMode}</span>
        {!generation.publishable ? <span className="block text-xs">Not publishable</span> : null}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[190px] align-top break-words">
        {generation.model}
      </TableCell>
      <TableCell className="text-muted-foreground align-top text-right whitespace-nowrap">
        <GenerationTokens generation={generation} />
      </TableCell>
      <TableCell className="text-muted-foreground align-top text-right whitespace-nowrap">
        {generation.status === "running" ? "…" : formatUsd(generation.costUsd)}
      </TableCell>
    </TableRow>
  );
}

function GenerationCard({
  generation,
  gameSlug,
}: {
  generation: AdminGeneration;
  gameSlug: string;
}) {
  return (
    <article className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/admin/generations/${generation.id}?game=${gameSlug}`}
            className="text-primary block font-medium underline-offset-4 hover:underline"
          >
            {formatGenerationTime(generation.createdAt)}
          </Link>
          <Link
            to={`/admin/dates/${generation.dateKey}?game=${gameSlug}`}
            className="text-muted-foreground mt-1 block text-sm underline-offset-4 hover:underline"
          >
            Puzzle date {generation.dateKey}
          </Link>
        </div>
        <GenerationStatus generation={generation} compact />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">Source</dt>
          <dd className="mt-1 truncate font-medium">
            {generation.sourceMode}
            {!generation.publishable ? " · not publishable" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">Tokens</dt>
          <dd className="mt-1 font-medium">
            <GenerationTokens generation={generation} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-muted-foreground text-xs">Model</dt>
          <dd className="mt-1 break-words font-medium">{generation.model}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">Cost</dt>
          <dd className="mt-1 font-medium">
            {generation.status === "running" ? "…" : formatUsd(generation.costUsd)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function GenerationStatus({
  generation,
  compact = false,
}: {
  generation: AdminGeneration;
  compact?: boolean;
}) {
  const error = generation.llmError ? friendlyError(generation.llmError) : null;
  return (
    <div className={`flex flex-col ${compact ? "items-end gap-1" : "gap-1"}`}>
      <StatusBadge status={generation.status} config={GENERATION_STATUS} />
      {error ? (
        <span
          className={`text-destructive text-xs ${compact ? "max-w-[170px] text-right" : "max-w-[280px]"}`}
          title={error}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function GenerationTokens({ generation }: { generation: AdminGeneration }) {
  if (generation.status === "running") return "…";
  return (
    <>
      {formatTokenCount(generation.totalTokens)}
      {generation.reasoningTokens
        ? ` (${formatTokenCount(generation.reasoningTokens)} reasoning)`
        : ""}
    </>
  );
}

function formatGenerationTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
