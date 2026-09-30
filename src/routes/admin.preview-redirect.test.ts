import { describe, expect, it } from "vitest";

import { loader } from "./admin.preview-redirect";

describe("legacy admin preview redirect", () => {
  it("sends requests without a topic to the all-topics admin page", async () => {
    const response = await loader({
      request: new Request("https://newsboy.example/admin/preview?source=legacy"),
    } as Parameters<typeof loader>[0]);

    expect(response.headers.get("Location")).toBe("/admin?source=legacy");
  });

  it("preserves the selected topic when redirecting to its create page", async () => {
    const response = await loader({
      request: new Request("https://newsboy.example/admin/preview?game=reality&date=2026-09-30"),
    } as Parameters<typeof loader>[0]);

    expect(response.headers.get("Location")).toBe("/admin/topics/reality/create?date=2026-09-30");
  });
});
