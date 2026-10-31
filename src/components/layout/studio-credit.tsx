import { STUDIO_NAME, STUDIO_URL } from "~/config/brand";

import styles from "./studio-credit.module.css";

interface StudioCreditProps {
  className?: string;
}

/**
 * The Ponti Studios mark and link. Shared by the footer and the about page so
 * the attribution stays one accessible link with one destination.
 */
export function StudioCredit({ className }: StudioCreditProps) {
  return (
    <a
      className={[styles.credit, className].filter(Boolean).join(" ")}
      href={STUDIO_URL}
      rel="noopener"
    >
      <img alt="" className={styles.mark} height={24} src="/ponti-mark.png" width={24} />
      <span>{STUDIO_NAME}</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
