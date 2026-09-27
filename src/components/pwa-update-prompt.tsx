/**
 * Glass update toast — the service-worker "new version" prompt.
 *
 * DESIGN SPEC (owned): frosted glass pane in the game's paper palette, springy
 * pop entrance, pinging "new build" beacon, icon actions — X defers, the
 * download arrow applies the update (named "Later"/"Update" for assistive
 * tech and the stories). Styling is Tailwind utilities merged via `cn`;
 * colors come from the `--game-glass*` / `--game-blush` tokens in app.css;
 * animations & engine fallbacks live in pwa-update-prompt.module.css.
 *
 * DO NOT restyle or repurpose this component without updating the Game/UpdatePrompt
 * stories (visible/hidden states, both button flows) and keeping the `role="status"`
 * live region, labelled buttons, and prefers-reduced-motion handling intact.
 */
import { cn } from "cn";
import { Download, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import styles from "./pwa-update-prompt.module.css";

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-game-glass-border bg-game-glass text-game-ink fixed right-(--game-gutter-right) bottom-(--game-gutter-bottom) isolate z-20 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border px-4.5 py-4 backdrop-blur-[26px] backdrop-saturate-[1.75] dark:backdrop-blur-[28px] dark:backdrop-saturate-[1.8]",
        styles.promptSolid,
        styles.animatePrompt,
      )}
    >
      <p className="m-0 flex items-center gap-2.5 text-base font-extrabold tracking-wide">
        <span
          aria-hidden="true"
          className={cn(
            "bg-game-correct-bg relative h-2 w-2 flex-none rounded-full",
            styles.animateBeacon,
          )}
        />
        A fresh version of Newsboy is ready.
      </p>
      <div className="relative mt-3.5 flex gap-2.5">
        <button
          type="button"
          aria-label="Later"
          onClick={() => setNeedRefresh(false)}
          className={cn(
            "icon-button border-game-glass-ghost-border bg-game-glass-ghost text-game-ink hover:border-game-glass-ghost-border-hover hover:bg-game-glass-ghost-hover border [backdrop-filter:blur(4px)] transition-[background-color,border-color] duration-200 [-webkit-backdrop-filter:blur(4px)]",
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Update"
          onClick={() => void updateServiceWorker(true)}
          className={cn(
            "icon-button from-game-correct-bg via-game-blush to-game-correct-bg text-game-correct-text border border-transparent bg-linear-135 bg-[length:180%_180%] transition-[translate,scale] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
            styles.animateLiquid,
          )}
        >
          <Download className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
