import type { LoaderFunctionArgs } from "react-router";

import { getHominemUser } from "~/lib/infrastructure/hominem-auth";
import { loadActivePuzzleAttempt } from "~/lib/data/puzzle.server";
import { resolveGameTimeZone } from "~/lib/infrastructure/game-request";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const timeZone = resolveGameTimeZone(request);
  const user = await getHominemUser(request);
  const gameSlug = params.topic!;
  const attempt = await loadActivePuzzleAttempt(new Date(), timeZone, user, gameSlug);
  return Response.json({ attempt });
}
