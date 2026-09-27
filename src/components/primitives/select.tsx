import type { SelectHTMLAttributes } from "react";

import styles from "./select.module.css";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
};

/** A native <select> — no positioning/portal machinery needed for a plain dropdown. */
export function Select({ options, onValueChange, className, ...props }: SelectProps) {
  return (
    <select
      className={[styles.select, className].filter(Boolean).join(" ")}
      onChange={(event) => onValueChange((event.target as HTMLSelectElement).value)}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
