import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { gamesPuzzles, generationCandidates, generationRuns } from "@pontistudios/db";

function foreignKeyOnDelete(table: Parameters<typeof getTableConfig>[0], columnName: string) {
  return getTableConfig(table).foreignKeys.find((foreignKey) =>
    foreignKey.reference().columns.some((column) => column.name === columnName),
  )?.onDelete;
}

describe("game admin schema", () => {
  it("nulls games_puzzles.generation_run_id when a run is deleted", () => {
    expect(foreignKeyOnDelete(gamesPuzzles, "generation_run_id")).toBe("set null");
  });

  it("cascades generation candidates when their run is deleted", () => {
    expect(foreignKeyOnDelete(generationCandidates, "run_id")).toBe("cascade");
  });

  it("restricts deleting a topic that still has generation runs", () => {
    expect(foreignKeyOnDelete(generationRuns, "games_topic_id")).toBe("restrict");
  });
});
