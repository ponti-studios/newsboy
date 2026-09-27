import { MetricCard } from "@ponti-studios/ui/data-display";
import { SectionIntro } from "@ponti-studios/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ponti-studios/ui/data-display";
import { EmptyState } from "@ponti-studios/ui/feedback";
import { Button } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData } from "react-router";

import { formatTokenCount, formatUsd } from "~/lib/admin/format";
import {
  getGenerationCostReport,
  type GenerationCostBreakdownRow,
  type GenerationModelBreakdownRow,
} from "~/lib/data/generation-runs.server";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} generation cost` }, { name: "robots", content: "noindex" }];
}

export async function loader() {
  const report = await getGenerationCostReport({ sinceDays: 30 });
  return report;
}

function BreakdownTable({
  title,
  rows,
  emptyLabel,
  showOutcomeRates = false,
}: {
  title: string;
  rows: GenerationCostBreakdownRow[] | GenerationModelBreakdownRow[];
  emptyLabel: string;
  showOutcomeRates?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {showOutcomeRates ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Success and failure rates exclude runs that are still in progress.
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={emptyLabel} description="No generation runs in this window." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title}</TableHead>
              <TableHead>Runs</TableHead>
              {showOutcomeRates ? (
                <>
                  <TableHead>Success %</TableHead>
                  <TableHead>Failure %</TableHead>
                </>
              ) : null}
              <TableHead>Tokens</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key ?? "unknown"}>
                <TableCell className="font-medium">{row.key ?? "unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{row.count}</TableCell>
                {showOutcomeRates ? (
                  <>
                    <TableCell className="text-muted-foreground">
                      {formatOutcomeRate((row as GenerationModelBreakdownRow).successRate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatOutcomeRate((row as GenerationModelBreakdownRow).failureRate)}
                    </TableCell>
                  </>
                ) : null}
                <TableCell className="text-muted-foreground">
                  {formatTokenCount(row.totalTokens)}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatUsd(row.costUsd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function formatOutcomeRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default function GameAdminCosts() {
  const report = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/admin">← Admin</Link>
      </Button>

      <SectionIntro
        title="Generation cost"
        description={`All generation runs across every topic — last ${report.sinceDays} days.`}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total runs" value={report.totalRuns} />
        <MetricCard label="Total tokens" value={formatTokenCount(report.totalTokens)} />
        <MetricCard label="Total cost" value={formatUsd(report.totalCostUsd)} />
      </section>

      <BreakdownTable title="Trigger" rows={report.byTrigger} emptyLabel="No triggers" />
      <BreakdownTable
        title="Environment"
        rows={report.byEnvironment}
        emptyLabel="No environments"
      />
      <BreakdownTable title="Model" rows={report.byModel} emptyLabel="No models" showOutcomeRates />
    </main>
  );
}
