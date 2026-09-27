import type { LoaderFunctionArgs } from "react-router";

import { getActiveGames } from "~/lib/data/games.server";

export async function loader({}: LoaderFunctionArgs) {
  const games = await getActiveGames();
  return Response.json({
    games: games.map((game) => ({ slug: game.slug, name: game.name })),
  });
}
