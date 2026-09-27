import type { LabelHTMLAttributes } from "react";

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} />;
}
