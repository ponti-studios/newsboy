import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type SlotProps = Record<string, unknown> & {
  className?: unknown;
  children?: ReactNode;
};

/** Merges `props` onto its single child instead of rendering a wrapper element. */
export function Slot({ children, className, ...props }: SlotProps) {
  if (!isValidElement(children)) return (children ?? null) as never;
  const child = children as ReactElement<{ className?: string }>;
  return cloneElement(
    child as never,
    {
      ...props,
      ...child.props,
      className:
        [className, child.props.className].filter(Boolean).map(String).join(" ") || undefined,
    } as never,
  );
}
