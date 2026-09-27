import { readFile } from "node:fs/promises";

import type { FeedItem } from "../generation/types";

export interface SourceCapture {
  id: string;
  genre: string;
  sourceUrl: string;
  capturedAt: string;
  items: FeedItem[];
}

export async function readSourceCapture(path: string): Promise<SourceCapture> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf-8"));
  if (!parsed || typeof parsed !== "object") throw new Error(`Invalid source fixture: ${path}`);
  const fixture = parsed as Partial<SourceCapture>;
  if (
    typeof fixture.id !== "string" ||
    typeof fixture.genre !== "string" ||
    typeof fixture.sourceUrl !== "string" ||
    !Array.isArray(fixture.items)
  ) {
    throw new Error(`Source fixture is missing required fields: ${path}`);
  }
  return fixture as SourceCapture;
}
