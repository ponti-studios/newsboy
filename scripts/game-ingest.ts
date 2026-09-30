import { ensureGameCatalog, ingestAllActiveFeeds } from "../src/lib/generation/ingest.server";
import { createLogger } from "../src/lib/logger.server";
import { runScript } from "./_shared/run-script";

const logger = createLogger();

async function main() {
  const startedAt = Date.now();
  const ingestLogger = logger.child({ operation: "gameIngest" });
  ingestLogger.info({ event: "ingest.run.started" }, "starting feed ingest run");

  await ensureGameCatalog();
  const summary = await ingestAllActiveFeeds();

  ingestLogger.info(
    {
      event: "ingest.run.completed",
      ...summary,
      durationMs: Date.now() - startedAt,
    },
    `ingest complete: ${summary.inserted} new, ${summary.extracted} article text(s) extracted, ${summary.failed + summary.emptyBody} unresolved`,
  );
}

if (!process.env.VITEST) await runScript(main);
