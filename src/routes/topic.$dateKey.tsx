import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import { GameBoard } from "../components/game";
import styles from "../components/pages/date-page.module.css";
import { Button, Card, CardContent } from "../components/primitives";
import { BRAND_NAME } from "../config/brand";
import { getGameBySlug } from "../lib/data/games.server";
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
  const envelope = await loadPuzzleForSpecificDate(dateKey, user, topic);
  if (!envelope) {
    throw new Response(`No ${BRAND_NAME} puzzle found for that date`, { status: 404 });
  }

  return { ...envelope, signedIn: user !== null, loginUrl: loginUrl(request), gameSlug: topic };
}

export default function DatedPuzzleRoute() {
  const { puzzle, attempt, signedIn, loginUrl, gameSlug } = useLoaderData<typeof loader>();
  if (!signedIn) {
    return <SignedOutTeaser dateKey={puzzle.dateKey} loginUrl={loginUrl} />;
  }

  return (
    <GameBoard
      puzzle={puzzle}
      initialGuesses={attempt?.guesses ?? []}
      loginUrl={loginUrl}
      gameSlug={gameSlug}
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
