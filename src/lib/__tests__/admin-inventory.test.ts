import { describe, expect, it } from "vitest";

import { buildInventoryCells, overviewInventoryDateKeys } from "../admin/inventory";

describe("overviewInventoryDateKeys", () => {
  it("returns 11 days: 5 ago, today, and 5 ahead", () => {
    expect(overviewInventoryDateKeys("2026-08-13")).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
  });
});

describe("buildInventoryCells", () => {
  it("marks UTC/PT today and missing vs ready vs live", () => {
    const now = new Date("2026-08-13T06:00:00Z");
    const cells = buildInventoryCells({
      now,
      existingKeys: ["2026-08-12", "2026-08-13"],
      attemptCounts: new Map([["2026-08-13", 2]]),
    });
    expect(cells).toHaveLength(11);
    expect(cells[0]?.dateKey).toBe("2026-08-08");
    expect(cells[cells.length - 1]?.dateKey).toBe("2026-08-18");
    const byDate = Object.fromEntries(cells.map((cell) => [cell.dateKey, cell]));
    expect(byDate["2026-08-12"]?.state).toBe("live");
    expect(byDate["2026-08-12"]?.isPacificToday).toBe(true);
    expect(byDate["2026-08-13"]?.state).toBe("live");
    expect(byDate["2026-08-13"]?.isUtcToday).toBe(true);
    expect(byDate["2026-08-13"]?.attemptCount).toBe(2);
    expect(byDate["2026-08-14"]?.state).toBe("missing");
    expect(byDate["2026-08-07"]).toBeUndefined();
    expect(byDate["2026-08-19"]).toBeUndefined();
  });
});
