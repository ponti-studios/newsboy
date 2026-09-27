import type { ButtonHTMLAttributes } from "react";

import styles from "./button.module.css";
import { Slot } from "./slot";

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const sizeClass: Record<ButtonSize, string> = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  icon: styles.sizeIcon,
};

export function Button({
  asChild = false,
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(" ");
  if (asChild) return <Slot className={classes} {...props} />;
  return <button className={classes} {...props} />;
}
