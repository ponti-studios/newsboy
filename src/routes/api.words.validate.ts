import type { ActionFunctionArgs } from "react-router";

import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";
import { getGameBySlug } from "~/lib/data/games.server";
import { isValidWord } from "~/lib/data/word-list.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { word } = (await request.json()) as { word?: unknown };
    if (typeof word !== "string") {
      return Response.json({ error: "Invalid word payload" }, { status: 400 });
    }

    const game = await getGameBySlug(DEFAULT_GAME_SLUG);
    if (!game) return Response.json({ error: "Game not found" }, { status: 500 });
    return Response.json({ valid: await isValidWord(word, game.id) });
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
}
