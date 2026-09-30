import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { DatabaseEnv } from "@pontistudios/env";

const dbPackagePath = new URL("../node_modules/@pontistudios/db/migrations/", import.meta.url);
const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dbPackagePath), "utf8"));
const latestMigration = journal.entries.at(-1);

if (!latestMigration) {
  throw new Error("The pinned database package has no Drizzle migrations");
}

const migrationSql = await readFile(new URL(`${latestMigration.tag}.sql`, dbPackagePath));
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const { DATABASE_URL } = DatabaseEnv.parse(process.env);
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

  console.log(`Production has the migration required by the pinned DB package: ${latestMigration.tag}`);
} finally {
  await sql.end({ timeout: 5 });
}
