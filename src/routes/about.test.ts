import { describe, expect, it } from "vitest";

import routes from "../routes";
import { meta } from "./about";

interface RouteEntry {
  path?: string;
  file?: string;
  children?: RouteEntry[];
}

function findRoute(entries: readonly RouteEntry[], path: string): RouteEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    const child = entry.children ? findRoute(entry.children, path) : undefined;
    if (child) return child;
  }
  return undefined;
}

describe("about route", () => {
  it("registers /about inside the app layout", () => {
    expect(findRoute(routes as RouteEntry[], "/about")).toMatchObject({
      file: "routes/about.tsx",
    });
  });

  it("gives the page its own title and description", () => {
    const tags = meta();

    expect(tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "About — Newsboy" }),
        expect.objectContaining({
          name: "description",
          content: expect.stringContaining("Newsboy"),
        }),
      ]),
    );
  });
});
