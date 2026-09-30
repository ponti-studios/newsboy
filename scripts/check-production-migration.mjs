import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";

const migrationsPath = new URL("../migrations/", import.meta.url);
const journal = JSON.parse(await readFile(new URL("meta/_journal.json", migrationsPath), "utf8"));
const latestMigration = journal.entries.at(-1);

if (!latestMigration) {
  throw new Error("Newsboy has no Drizzle migrations");
}

const migrationSql = await readFile(new URL(`${latestMigration.tag}.sql`, migrationsPath));
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const { DATABASE_URL } = z
  .object({ DATABASE_URL: z.string().url() })
  .parse(process.env);
const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 10 });

try {
  const applied = await sql`
    select id
    from labs.__drizzle_migrations
    where hash = ${migrationHash}
    limit 1
  `;

  if (applied.length !== 1) {
    throw new Error(
      `Required migration ${latestMigration.tag} is not recorded in production. ` +
        "Wait for the Labs production migration workflow before deploying Newsboy.",
    );
  }

  console.log(`Production has the migration required by Newsboy: ${latestMigration.tag}`);
} finally {
  await sql.end({ timeout: 5 });
}
