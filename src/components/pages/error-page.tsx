import { Link } from "react-router";

import { Button } from "../primitives/button";

import styles from "./error-page.module.css";

type ErrorPageProps = {
  status: number;
  message?: string;
  details?: string;
};

const ERROR_COPY: Record<number, { eyebrow: string; title: string; message: string }> = {
  404: {
    eyebrow: "Wrong turn",
    title: "That page isn't here.",
    message: "The clue may have moved, or the link may be out of date.",
  },
  401: {
    eyebrow: "Sign-in required",
    title: "This round is for members.",
    message: "Sign in to pick up where you left off.",
  },
  403: {
    eyebrow: "Access limited",
    title: "You can't open this round.",
    message: "This page is reserved for a different kind of player.",
  },
  429: {
    eyebrow: "Take a breath",
    title: "Too many guesses at once.",
    message: "Give it a moment, then try again.",
  },
  503: {
    eyebrow: "Quick reset",
    title: "The game is taking a pause.",
    message: "Try again in a moment, or head back to the game.",
  },
};

export function ErrorPage({ status, message, details }: ErrorPageProps) {
  const copy = ERROR_COPY[status] ?? {
    eyebrow: "Page error",
    title: "This round got interrupted.",
    message: "We couldn't load this page right now. Try again or head back to the game.",
  };
  const canRetry = status >= 500 || status === 408 || status === 429;
  const pageClassName = [styles.page, status === 404 ? styles.notFound : styles.server]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={pageClassName} aria-labelledby="error-title">
      <section className={styles.card}>
        <div className={styles.content}>
          <div className={styles.tiles} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span className={styles.tile} key={index} />
            ))}
          </div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <p className={styles.status} aria-label={`Error ${status}`}>
            {status}
          </p>
          <h1 className={styles.title} id="error-title">
            {copy.title}
          </h1>
          <p className={styles.message}>{message ?? copy.message}</p>
          <div className={styles.actions}>
            {canRetry ? (
              <Button type="button" onClick={() => window.location.reload()}>
                Try again
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/">Back to the game</Link>
            </Button>
          </div>
          {details ? <pre className={styles.details}>{details}</pre> : null}
        </div>
      </section>
    </main>
  );
}
