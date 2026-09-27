import { useLoaderData, useSearchParams, type LoaderFunctionArgs } from "react-router";

import { HistoryGuestView, HistoryPageView } from "../components/pages/history-page";
import { loadPuzzleHistory } from "../lib/data/history.server";
import { getGameUser, loginUrl } from "../server/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const login = loginUrl(request);
  const user = await getGameUser(request);

  if (!user) {
    return { signedIn: false as const, loginUrl: login };
  }

  const url = new URL(request.url);
  const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const history = await loadPuzzleHistory(user.id, { page });

  return { signedIn: true as const, loginUrl: login, history };
}

export default function HistoryRoute() {
  const props = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  if (!props.signedIn) {
    return <HistoryGuestView loginUrl={props.loginUrl} />;
  }

  const setPage = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", String(page));
      return prev;
    });
  };

  return <HistoryPageView history={props.history} onPageChange={setPage} />;
}
