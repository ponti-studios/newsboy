import styles from "./status-badge.module.css";

export type StatusBadgeVariant = "default" | "destructive" | "outline" | "secondary";

/** One status's display config — a config map is `Record<TStatus, StatusBadgeConfig>`. */
export type StatusBadgeConfig = { label: string; variant: StatusBadgeVariant };

export type StatusBadgeProps<TStatus extends string = string> = {
  status: TStatus;
  config: Record<TStatus, StatusBadgeConfig>;
};

export function StatusBadge<TStatus extends string>({ status, config }: StatusBadgeProps<TStatus>) {
  const entry = config[status];
  return <span className={[styles.badge, styles[entry.variant]].join(" ")}>{entry.label}</span>;
}
