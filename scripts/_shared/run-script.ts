import "dotenv/config";

import { closeDb } from "~/lib/infrastructure/db";
import { NewsboyGenerationEnv } from "~/lib/infrastructure/env";

export async function runScript(main: () => Promise<void>): Promise<void> {
  NewsboyGenerationEnv.parse(process.env);

  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
