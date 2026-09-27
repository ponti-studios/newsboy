import type { HTMLAttributes } from "react";

import styles from "./card.module.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.card, className].filter(Boolean).join(" ")} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.content, className].filter(Boolean).join(" ")} {...props} />;
}
