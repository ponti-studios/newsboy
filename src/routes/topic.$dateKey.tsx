import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import { GameBoard } from "../components/game";
import styles from "../components/pages/date-page.module.css";
import { Button, Card, CardContent } from "../components/primitives";
import { BRAND_NAME } from "../config/brand";
import { getGameBySlug } from "../lib/data/games.server";
import { loadGuestPuzzleHistoryPreview, loadPlayerStats } from "../lib/data/history.server";
import { loadPuzzleForSpecificDate } from "../lib/data/puzzle.server";
import { isDateKey } from "../lib/puzzle/date";
import { getGameUser, loginUrl } from "../server/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const topic = params.topic!;
  const dateKey = params.dateKey!;

  const game = await getGameBySlug(topic);
  if (!game || !game.active) {
    throw new Response("Unknown game", { status: 404 });
  }
  if (!isDateKey(dateKey)) {
    throw new Response("Invalid puzzle date", { status: 400 });
  }

  const user = await getGameUser(request);
  const [envelope, guestPreview, stats] = await Promise.all([
    loadPuzzleForSpecificDate(dateKey, user, topic),
    user ? Promise.resolve([]) : loadGuestPuzzleHistoryPreview(),
    user ? loadPlayerStats(user.id) : Promise.resolve(null),
  ]);
  if (!envelope) {
    throw new Response(`No ${BRAND_NAME} puzzle found for that date`, { status: 404 });
  }

  const canPlayAsGuest = guestPreview.some((puzzle) => puzzle.gameSlug === topic && puzzle.dateKey === dateKey);

  return {
    ...envelope,
    signedIn: user !== null,
    canPlayAsGuest,
    loginUrl: loginUrl(request),
    gameSlug: topic,
    stats,
  };
}

export default function DatedPuzzleRoute() {
  const { puzzle, attempt, signedIn, canPlayAsGuest, loginUrl, gameSlug, stats } =
    useLoaderData<typeof loader>();
  if (!signedIn && !canPlayAsGuest) {
    return <SignedOutTeaser dateKey={puzzle.dateKey} loginUrl={loginUrl} />;
  }

  return (
    <GameBoard
      puzzle={puzzle}
      initialGuesses={attempt?.guesses ?? []}
      gameSlug={gameSlug}
      isSignedIn={signedIn}
      serverStats={stats}
    />
  );
}

function SignedOutTeaser({ dateKey, loginUrl }: { dateKey: string; loginUrl: string }) {
  return (
    <div className={styles.teaser}>
      <div className={styles.body}>
        <div className={styles.clue}>
          <p className={styles.clueLabel}>{dateKey}</p>
        </div>

        <Card className={styles.card}>
          <CardContent className={styles.cardContent}>
            <div>
              <p className={styles.clueLabel}>Sign in to play</p>
              <p style={{ marginTop: "0.25rem", fontSize: "0.875rem" }}>
                Six guesses a day, saved automatically — sign in to play this puzzle.
              </p>
            </div>
            <Button asChild variant="default">
              <a href={loginUrl}>Sign in to play</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
