export function clampPage(value: string | null, pageCount: number): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  const page = Number.isFinite(parsed) ? parsed : 0;
  return Math.min(Math.max(0, page), Math.max(0, pageCount - 1));
}
