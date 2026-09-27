import { formatCurrency } from "~/lib/utils";

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatTokenCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}
