import { useLoaderData, useRevalidator, type LoaderFunctionArgs } from "react-router";

import { GameBoard } from "../components/game";
import { useTimeZone } from "../hooks/use-timezone";
import { getGameBySlug } from "../lib/data/games.server";
import { loadActivePublicPuzzleWithAttempt } from "../lib/data/puzzle.server";
import { readTimeZoneCookie } from "../lib/puzzle/timezone";
import { getGameUser, loginUrl } from "../server/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const topic = params.topic!;
  const game = await getGameBySlug(topic);
  if (!game || !game.active) {
    throw new Response("Unknown game", { status: 404 });
  }

  const timeZone = readTimeZoneCookie(request.headers.get("Cookie")) ?? "UTC";
  const user = await getGameUser(request);

  const envelope = await loadActivePublicPuzzleWithAttempt(new Date(), timeZone, user, topic);

  const login = loginUrl(request);
  if (!envelope) {
    return { puzzle: null, loginUrl: login, gameSlug: topic };
  }

  return { ...envelope, loginUrl: login, gameSlug: topic };
}

export default function TodayRoute() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  useTimeZone(revalidator.revalidate);

  if (!data.puzzle) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ fontSize: "0.75rem", opacity: 0.7 }}>No puzzle available right now.</p>
      </div>
    );
  }

  const boardKey = `${data.gameSlug}:${data.attempt ? `${data.attempt.status}:${data.attempt.guesses.length}` : "none"}`;

  return (
    <GameBoard
      key={boardKey}
      puzzle={data.puzzle}
      initialGuesses={data.attempt?.guesses ?? []}
      loginUrl={data.loginUrl}
      gameSlug={data.gameSlug}
    />
  );
}
