import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_THEME_COLOR } from "./config/brand";
import { ErrorPage } from "./components/pages/error-page";
import { PwaUpdatePrompt } from "./components/pwa-update-prompt";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{BRAND_NAME}</title>
        <meta name="description" content={BRAND_TAGLINE} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={BRAND_NAME} />
        <meta property="og:description" content={BRAND_TAGLINE} />
        <meta property="og:image" content="/newsboy-mark.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={BRAND_NAME} />
        <meta name="twitter:description" content={BRAND_TAGLINE} />
        <meta name="twitter:image" content="/newsboy-mark.png" />
        <meta name="theme-color" content={BRAND_THEME_COLOR} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/icons/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/icons/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/icons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useEffect(() => {
    if (!import.meta.env.DEV || !("serviceWorker" in navigator)) return;

    // Remove the old handwritten worker once when a development page loads.
    // It cached un-hashed Vite modules and could cause hydration mismatches.
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    void caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("game-")).map((key) => caches.delete(key))),
      );
  }, []);

  return (
    <>
      <Outlet />
      <PwaUpdatePrompt />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    details =
      typeof error.data === "string"
        ? error.data
        : error.status === 404
          ? "The requested page could not be found."
          : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return <ErrorPage status={status} message={details} details={stack} />;
}
