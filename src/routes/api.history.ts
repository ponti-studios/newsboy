import type { LoaderFunctionArgs } from "react-router";

import { buildHominemLoginUrl, getHominemUser } from "~/lib/infrastructure/hominem-auth";
import { loadPuzzleHistory } from "~/lib/data/history.server";
import { resolveGameReturnTo } from "~/lib/infrastructure/game-request";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const loginUrl = buildHominemLoginUrl(resolveGameReturnTo(url));
  const user = await getHominemUser(request);

  if (!user) return Response.json({ signedIn: false as const, loginUrl });

  const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
  const history = await loadPuzzleHistory(user.id, { page });

  return Response.json({ signedIn: true as const, loginUrl, history });
}
