import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "@pontistudios/db";
import { withGenerateLock } from "~/lib/infrastructure/advisory-lock.server";

describe("withGenerateLock", () => {
  afterAll(() => {
    closeDb();
  });

  it("returns lock_busy to the second caller and releases afterwards", async () => {
    let releaseHold: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });

    const first = withGenerateLock(async () => {
      await held;
      return "first";
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await withGenerateLock(async () => "second");
    expect(second).toEqual({ ok: false, code: "lock_busy" });

    releaseHold?.();
    await expect(first).resolves.toEqual({ ok: true, value: "first" });

    const third = await withGenerateLock(async () => "third");
    expect(third).toEqual({ ok: true, value: "third" });
  });
});
