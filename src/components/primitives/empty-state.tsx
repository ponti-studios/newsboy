import type { HTMLAttributes, ReactNode } from "react";

import styles from "./empty-state.module.css";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} {...props}>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
