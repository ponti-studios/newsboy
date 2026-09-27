import { Alert, AlertDescription, AlertTitle } from "@ponti-studios/ui/feedback";

import { formatTokenCount, formatUsd } from "~/lib/admin/format";
import type { GenerateErr, GenerateOk } from "~/lib/admin/generate-types";

import { CandidateCards } from "./candidate-cards";
import styles from "./generate-result.module.css";

export function GenerateResult({
  result,
  gameSlug,
}: {
  result: GenerateOk | GenerateErr;
  gameSlug: string;
}) {
  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn’t finish this generation</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className={styles.section}>
      <p className="text-muted-foreground text-sm">
        {formatTokenCount(result.usage.totalTokens)} tokens
        {result.usage.reasoningTokens
          ? ` (${formatTokenCount(result.usage.reasoningTokens)} reasoning)`
          : ""}
        {" · "}
        {formatUsd(result.usage.costUsd)}
      </p>
      <div className={styles.card}>
        <CandidateCards
          candidates={result.candidates}
          generationId={result.generationId}
          gameSlug={gameSlug}
          publishable={result.publishable}
        />
      </div>
    </section>
  );
}
