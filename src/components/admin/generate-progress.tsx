import { Progress, Spinner } from "@ponti-studios/ui/feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ponti-studios/ui/primitives";
import { Check } from "lucide-react";

import { generateStagePercent } from "~/lib/admin/generate-copy";
import type { GenerateProgressEvent } from "~/lib/admin/generate-types";

import styles from "./generate-progress.module.css";

const STEPS = [
  { stage: "prepare", label: "Check the request" },
  { stage: "articles", label: "Gather stories" },
  { stage: "model", label: "Ask the model" },
  { stage: "score", label: "Check each word" },
  { stage: "done", label: "Ready to review" },
] as const;

function stepState(current: string, stage: string): "todo" | "current" | "done" {
  const order = STEPS.map((step) => step.stage);
  const currentIndex = order.indexOf(current as (typeof STEPS)[number]["stage"]);
  const stageIndex = order.indexOf(stage as (typeof STEPS)[number]["stage"]);
  if (currentIndex === -1) return "todo";
  if (stageIndex < currentIndex) return "done";
  if (stageIndex === currentIndex) return "current";
  return "todo";
}

function StageMark({
  state,
  running,
  failed,
}: {
  state: "todo" | "current" | "done";
  running: boolean;
  failed: boolean;
}) {
  if (state === "done" || (state === "current" && !running && !failed)) {
    return <Check className="size-4 shrink-0" aria-hidden />;
  }
  if (state === "current" && running) {
    return <Spinner size="sm" label={false} />;
  }
  return (
    <span className="text-muted-foreground w-4 shrink-0 text-center" aria-hidden>
      -
    </span>
  );
}

export function GenerateProgress({
  running,
  failed,
  stage,
}: {
  running: boolean;
  failed: boolean;
  stage: GenerateProgressEvent | null;
}) {
  if (!running && !stage) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {running ? <Spinner size="sm" label={false} /> : null}
          {running ? "Working" : "Last generation"}
        </CardTitle>
        <CardDescription>
          <span key={`${stage?.stage ?? "idle"}:${stage?.detail ?? ""}`} className={styles.detail}>
            {stage?.detail ?? "Waiting for the first update."}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress
          value={generateStagePercent(stage?.stage ?? "prepare")}
          className={styles.progress}
          indicatorClassName="transition-transform duration-200"
        />
        <ol className="grid gap-2">
          {STEPS.map((step) => {
            const state = stepState(stage?.stage ?? "prepare", step.stage);
            return (
              <li key={step.stage} className={styles.step} data-state={state}>
                <StageMark state={state} running={running} failed={failed} />
                <span className="font-medium">
                  {state === "current" && stage ? stage.label : step.label}
                </span>
                {state === "current" && stage ? (
                  <span className="text-muted-foreground"> — {stage.detail}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
