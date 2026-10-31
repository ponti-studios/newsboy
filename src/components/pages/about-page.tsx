import { Link } from "react-router";

import { BRAND_NAME, BRAND_TAGLINE, STUDIO_NAME } from "~/config/brand";

import styles from "./about-page.module.css";
import { StudioCredit } from "../layout/studio-credit";

export const ABOUT_DESCRIPTION =
  "Newsboy is Ponti Studios' multi-topic daily news puzzle. Guess the five-letter answer from today's story in six tries.";

export function AboutPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>About {BRAND_NAME}</p>
        <h1 className={styles.title}>{BRAND_NAME}</h1>
        <p className={styles.tagline}>{BRAND_TAGLINE}</p>
      </header>

      <div className={styles.body}>
        <p className={styles.lede}>
          {BRAND_NAME} is {STUDIO_NAME}&apos; multi-topic daily news puzzle. Each day, a story from
          the news becomes a five-letter answer.
        </p>
        <p>
          Guess the answer in six tries. Each guess shows which letters match and where they belong,
          and a final clue appears before your last guess.
        </p>
        <p>
          There&apos;s one shared puzzle per topic each day. You can play without an account, and
          this device saves your progress.
        </p>
        <p>
          {BRAND_NAME} is made by {STUDIO_NAME}.
        </p>
      </div>

      <div className={styles.actions}>
        <Link className={styles.play} to="/">
          Play today&apos;s puzzle <span aria-hidden="true">→</span>
        </Link>
      </div>

      <section aria-label={`Made by ${STUDIO_NAME}`} className={styles.studio}>
        <StudioCredit />
      </section>
    </main>
  );
}
