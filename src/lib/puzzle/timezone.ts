import { DATE_KEY_LOCALE } from "./date";

export const TIME_ZONE_COOKIE = "newsboy_timezone";
export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(DATE_KEY_LOCALE, { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function readTimeZoneCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TIME_ZONE_COOKIE}=`));
  if (!entry) return null;

  try {
    const value = decodeURIComponent(entry.slice(TIME_ZONE_COOKIE.length + 1));
    return isValidTimeZone(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveTimeZone(cookieHeader: string | null | undefined): string {
  return readTimeZoneCookie(cookieHeader) ?? DEFAULT_TIME_ZONE;
}
