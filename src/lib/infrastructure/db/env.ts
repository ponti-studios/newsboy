import { z } from "zod";

export const DbEnv = z
  .object({ DATABASE_URL: z.string().min(1) })
  .transform((env) => ({ url: env.DATABASE_URL }));

export type DbEnv = z.infer<typeof DbEnv>;
