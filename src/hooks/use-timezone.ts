import { useEffect } from "react";

import { readTimeZoneCookie, TIME_ZONE_COOKIE } from "../lib/puzzle/timezone";

const COOKIE_MAX_AGE_SECONDS = 31536000;

export function useTimeZone(onSync: () => void): void {
  // Do not run this hook on the server, since it relies on the browser's Intl API and document.cookie.
  if (typeof window === "undefined") {
    return;
  }

  useEffect(() => {
    const syncTimeZone = () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const cookieValue = readTimeZoneCookie(document.cookie);

      if (cookieValue !== timeZone) {
        document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
      }

      onSync();
    };

    syncTimeZone();
    window.addEventListener("focus", syncTimeZone);
    return () => window.removeEventListener("focus", syncTimeZone);
  }, [onSync]);
}
