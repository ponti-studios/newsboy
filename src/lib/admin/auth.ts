import {
  createContext,
  redirect,
  type MiddlewareFunction,
  type RouterContextProvider,
} from "react-router";

import { buildHominemLoginUrl, getHominemUser } from "~/lib/infrastructure/hominem-auth";

export type GameAdminActor = {
  userId: string;
};

export const gameAdminActorContext = createContext<GameAdminActor>();

function allowlistRequired() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function parseAllowlist(): string[] | null {
  const raw = process.env.GAME_ADMIN_EMAILS;
  if (raw === undefined || raw.trim() === "") return null;
  const emails = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return emails.length > 0 ? emails : null;
}

export function canAccessGameAdmin(user: { email?: string | null } | null): boolean {
  if (!user) return false;

  const allowlist = parseAllowlist();
  if (allowlistRequired() && allowlist === null) return false;
  if (allowlist === null) return true;

  const email = user.email?.trim().toLowerCase();
  return Boolean(email && allowlist.includes(email));
}

export async function requireGameAdmin(
  request: Request,
  kind: "loader" | "action",
): Promise<GameAdminActor> {
  const user = await getHominemUser(request);
  const loginUrl = buildHominemLoginUrl(request.url);
  if (!user) {
    if (kind === "loader") throw redirect(loginUrl);
    throw Response.json({ error: "auth-required", loginUrl }, { status: 401 });
  }

  const allowlist = parseAllowlist();
  if (allowlistRequired() && allowlist === null) {
    throw new Response("Admin allowlist not configured — set GAME_ADMIN_EMAILS", {
      status: 503,
    });
  }
  if (!canAccessGameAdmin(user)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { userId: user.id };
}

function requestKind(request: Request): "loader" | "action" {
  return request.method === "GET" || request.method === "HEAD" ? "loader" : "action";
}

/** Parent-route middleware: runs before child loaders/actions and short-circuits on deny. */
export const requireGameAdminMiddleware: MiddlewareFunction = async ({ request, context }) => {
  const actor = await requireGameAdmin(request, requestKind(request));
  context.set(gameAdminActorContext, actor);
};

export function getGameAdminActor(context: Readonly<RouterContextProvider>): GameAdminActor {
  return context.get(gameAdminActorContext);
}
