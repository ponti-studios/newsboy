import { Link, useLocation } from "react-router";

import { BRAND_NAME, BRAND_TAGLINE } from "~/config/brand";

import styles from "./newsboy-footer.module.css";
import { StudioCredit } from "./studio-credit";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** The topic routes are the only player surfaces with the fixed keyboard dock. */
function isGamePath(pathname: string) {
  return (
    pathname !== "/" && pathname !== "/about" && pathname !== "/history" && !isAdminPath(pathname)
  );
}

/**
 * Footer for the player-facing app. Admin keeps its own dense chrome, so the
 * footer stays off that surface.
 */
export function NewsboyFooter() {
  const { pathname } = useLocation();
  if (isAdminPath(pathname)) return null;

  return (
    <footer className={[styles.footer, isGamePath(pathname) ? styles.gameSurface : ""].join(" ")}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <p className={styles.brandName}>{BRAND_NAME}</p>
          <p className={styles.tagline}>{BRAND_TAGLINE}</p>
        </div>

        <div className={styles.meta}>
          <nav aria-label="Footer" className={styles.links}>
            <Link
              aria-current={pathname === "/about" ? "page" : undefined}
              className={styles.link}
              to="/about"
            >
              About
            </Link>
            <Link
              aria-current={pathname === "/history" ? "page" : undefined}
              className={styles.link}
              to="/history"
            >
              History
            </Link>
          </nav>
          <StudioCredit />
        </div>
      </div>
    </footer>
  );
}
