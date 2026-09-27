/** Joins truthy class names. No Tailwind-conflict resolution — we don't ship Tailwind here. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
