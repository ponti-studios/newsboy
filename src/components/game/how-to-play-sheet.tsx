import { CircleHelp } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../primitives";
import styles from "./how-to-play-sheet.module.css";

/**
 * The help icon is absolutely positioned (see .trigger) so it never
 * contributes to `.shell`'s layout height, unlike the `<details>` block it
 * replaced, which always reserved space for its summary row.
 */
export function HowToPlaySheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="How to play"
          className={styles.trigger}
          data-testid="how-to-play-trigger"
          title="How to play"
          type="button"
        >
          <CircleHelp aria-hidden="true" size={18} strokeWidth={2.25} />
        </button>
      </SheetTrigger>
      <SheetContent data-testid="how-to-play-sheet">
        <SheetHeader>
          <SheetTitle>How to play</SheetTitle>
        </SheetHeader>
        <p className={styles.body}>
          Guess the five-letter answer from today&apos;s news story in six tries. Each guess shows
          which letters match and where they belong. Your final clue appears before your last
          guess.
        </p>
        <p className={styles.body}>
          There&apos;s one shared puzzle per topic each day. You can play without an account; this
          device saves your progress. Newsboy uses AI to draft puzzles from current stories and
          runs automated checks before publication.
        </p>
      </SheetContent>
    </Sheet>
  );
}
