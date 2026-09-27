import { getServerAuth } from "@ponti-studios/auth/server";

import { isLoopbackHostname, NewsboyServerEnv } from "../lib/infrastructure/env";

export type GameUser = { id: string; email?: string | null };

export async function getGameUser(request: Request): Promise<GameUser | null> {
  try {
    const { HOMINEM_INTERNAL_API_URL } = NewsboyServerEnv.parse(process.env);
    const { user } = await getServerAuth(request, {
      apiBaseUrl: HOMINEM_INTERNAL_API_URL,
    });
    return user?.id ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}

export function loginUrl(request: Request, requestedReturnTo?: string): string {
  const { PORTLESS_URL, NEWSBOY_APP_URL, HOMINEM_API_URL } = NewsboyServerEnv.parse(process.env);
  const requestOrigin = new URL(request.url);
  const appOrigin = isLoopbackHostname(requestOrigin.hostname)
    ? requestOrigin
    : new URL(PORTLESS_URL ?? NEWSBOY_APP_URL);
  let returnTo = new URL(appOrigin);

  try {
    const candidate = new URL(requestedReturnTo ?? request.url);
    returnTo.pathname = candidate.pathname.replace(/\.data$/, "") || "/";
    const search = new URLSearchParams(candidate.search);
    search.delete("tz");
    returnTo.search = search.toString() ? `?${search.toString()}` : "";
    returnTo.hash = candidate.hash;
  } catch {
    returnTo.pathname = "/";
  }

  const url = new URL("/login", HOMINEM_API_URL);
  url.searchParams.set("next", returnTo.toString());
  return url.toString();
}
