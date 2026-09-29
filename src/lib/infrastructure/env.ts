import { z } from "zod";

export * from "@pontistudios/env";

const DEFAULT_HOMINEM_API_URL = "https://api.lvh.me";

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/**
 * Resolves HOMINEM_API_URL/HOMINEM_INTERNAL_API_URL before validation: in
 * development, an unset or loopback value is rewritten to the local-only
 * https://api.lvh.me default (portless proxies that origin); everywhere else
 * the configured value is left as-is, so a missing var fails NewsboyServerEnv's
 * validation instead of silently redirecting production users to lvh.me.
 * HOMINEM_INTERNAL_API_URL falls back to HOMINEM_API_URL when unset.
 */
function resolveHominemUrls(raw: unknown): Record<string, unknown> {
  const env = { ...(raw as Record<string, string | undefined>) };
  const isDevelopment = env.NODE_ENV === "development";

  if (
    isDevelopment &&
    (!env.HOMINEM_API_URL || isLoopbackHostname(new URL(env.HOMINEM_API_URL).hostname))
  ) {
    env.HOMINEM_API_URL = DEFAULT_HOMINEM_API_URL;
  }

  if (!env.HOMINEM_INTERNAL_API_URL) {
    env.HOMINEM_INTERNAL_API_URL = env.HOMINEM_API_URL;
  }
  if (
    isDevelopment &&
    (!env.HOMINEM_INTERNAL_API_URL ||
      isLoopbackHostname(new URL(env.HOMINEM_INTERNAL_API_URL).hostname))
  ) {
    env.HOMINEM_INTERNAL_API_URL = DEFAULT_HOMINEM_API_URL;
  }

  return env;
}

export const NewsboyServerEnv = z.preprocess(
  resolveHominemUrls,
  z.object({
    NEWSBOY_APP_URL: z.string().url(),
    PORTLESS_URL: z.string().url().optional(),
    GAME_ADMIN_EMAILS: z.string().optional(),
    HOMINEM_API_URL: z
      .string(
        "HOMINEM_API_URL is not set. Refusing to fall back to the local-only " +
          `${DEFAULT_HOMINEM_API_URL} default outside development.`,
      )
      .url(),
    HOMINEM_INTERNAL_API_URL: z.string().url(),
    NODE_ENV: z.string().optional(),
  }),
);

export type NewsboyServerEnv = z.infer<typeof NewsboyServerEnv>;
