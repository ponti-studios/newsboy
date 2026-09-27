import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fetchFeedItems } from "../src/lib/generation/ingest.server";
import { runScript } from "./_shared/run-script";

const DEFAULT_FEEDS = [
  { id: "tech-news", genre: "technology", url: "https://techcrunch.com/feed/" },
  { id: "page-six", genre: "celebrity", url: "https://pagesix.com/feed/" },
  { id: "tmz", genre: "celebrity", url: "https://www.tmz.com/rss.xml" },
  { id: "sports-news", genre: "sports", url: "https://www.cbssports.com/rss/headlines/" },
];

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "out-dir": { type: "string" },
      limit: { type: "string" },
      feed: { type: "string", multiple: true },
    },
    strict: true,
  });
  return {
    outDir: path.resolve(values["out-dir"] ?? "src/lib/values/sources"),
    limit: Math.max(1, Number.parseInt(values.limit ?? "20", 10)),
    feedIds: values.feed ?? [],
  };
}

async function main() {
  const options = parseOptions();
  const feeds =
    options.feedIds.length === 0
      ? DEFAULT_FEEDS
      : DEFAULT_FEEDS.filter((feed) => options.feedIds.includes(feed.id));

  if (feeds.length === 0) throw new Error("No matching feeds selected");
  await mkdir(options.outDir, { recursive: true });

  for (const feed of feeds) {
    const items = (await fetchFeedItems(feed.url))
      .filter((item) => item.link)
      .slice(0, options.limit);
    const fixture = {
      id: feed.id,
      genre: feed.genre,
      sourceUrl: feed.url,
      capturedAt: new Date().toISOString(),
      items,
    };
    const outputPath = path.join(options.outDir, `${feed.id}.json`);
    await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf-8");
    console.log(`${feed.id}: captured ${items.length} item(s) → ${outputPath}`);
  }
}

if (!process.env.VITEST) await runScript(main);
