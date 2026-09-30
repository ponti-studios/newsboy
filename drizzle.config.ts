import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./node_modules/@pontistudios/db/src/schema/*",
  out: "./node_modules/@pontistudios/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    schema: "labs",
  },
});
