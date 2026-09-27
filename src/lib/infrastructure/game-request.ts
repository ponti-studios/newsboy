import { resolveTimeZone } from "../puzzle/timezone";

export function resolveGameTimeZone(request: Request): string {
  return resolveTimeZone(request.headers.get("Cookie") ?? request.headers.get("cookie"));
}

export function resolveGameReturnTo(url: URL): string {
  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo) return url.origin;
  try {
    return new URL(returnTo).toString();
  } catch {
    return url.origin;
  }
}
