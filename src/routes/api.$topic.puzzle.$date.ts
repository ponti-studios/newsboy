import type { LoaderFunctionArgs } from "react-router";

import { BRAND_NAME } from "~/config/brand";
import { loadPuzzleForSpecificDate } from "~/lib/data/puzzle.server";
import { buildHominemLoginUrl, getHominemUser } from "~/lib/infrastructure/hominem-auth";
import { resolveGameReturnTo } from "~/lib/infrastructure/game-request";
import { isDateKey } from "~/lib/puzzle/date";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const dateKey = params.date;
  if (!dateKey || !isDateKey(dateKey)) {
    return Response.json({ code: "INVALID_DATE", error: "Invalid puzzle date" }, { status: 400 });
  }

  const url = new URL(request.url);
  const user = await getHominemUser(request);
  const gameSlug = params.topic!;
  const envelope = await loadPuzzleForSpecificDate(dateKey, user, gameSlug);

  if (!envelope) {
    return Response.json(
      { code: "PUZZLE_NOT_FOUND", error: `No ${BRAND_NAME} puzzle found for that date` },
      { status: 404 },
    );
  }

  return Response.json({
    ...envelope,
    signedIn: user !== null,
    loginUrl: buildHominemLoginUrl(resolveGameReturnTo(url)),
    gameSlug,
  });
}
