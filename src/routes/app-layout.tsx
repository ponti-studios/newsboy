import { isRouteErrorResponse, Outlet, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { NewsboyNavigation } from "~/components/layout/newsboy-navigation";
import { ErrorPage } from "~/components/pages/error-page";
import { canAccessGameAdmin } from "~/lib/admin/auth";
import { getActiveGames } from "~/lib/data/games.server";
import { getGameUser, loginUrl } from "~/server/auth";

import type { Route } from "./+types/app-layout";

export async function loader({ request }: LoaderFunctionArgs) {
  const [user, games] = await Promise.all([
    getGameUser(request).catch(() => null),
    getActiveGames().catch(() => []),
  ]);

  return {
    games: games.map(({ slug, name }) => ({ slug, name })),
    signedIn: user !== null,
    canAccessAdmin: canAccessGameAdmin(user),
    loginUrl: loginUrl(request),
  };
}

export default function AppLayout() {
  const navigation = useLoaderData<typeof loader>();

  return (
    <>
      <NewsboyNavigation {...navigation} />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const navigation = useLoaderData<typeof loader>();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? typeof error.data === "string"
      ? error.data
      : error.statusText
    : "An unexpected error occurred.";

  return (
    <>
      <NewsboyNavigation {...navigation} />
      <ErrorPage status={status} message={status === 404 ? undefined : message} />
    </>
  );
}
