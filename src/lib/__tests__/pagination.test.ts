import { describe, expect, it } from "vitest";

import { clampPage } from "../admin/pagination";

describe("clampPage", () => {
  it("clamps negative and malformed query values to the first page", () => {
    expect(clampPage("-1", 4)).toBe(0);
    expect(clampPage("invalid", 4)).toBe(0);
    expect(clampPage(null, 4)).toBe(0);
  });

  it("clamps pages beyond the final page", () => {
    expect(clampPage("99", 4)).toBe(3);
  });
});
