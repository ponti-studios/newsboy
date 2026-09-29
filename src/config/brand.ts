/**
 * Single source of truth for this game's brand copy. Swap the brand here
 * instead of hunting down hardcoded strings across the codebase.
 */
export const BRAND_NAME = "Newsboy";
export const BRAND_TAGLINE = "Wordplay, fresh off the press.";

/** Browser/OS chrome colors — SVG/JSON surface, so they live here, not in CSS. */
export const BRAND_THEME_COLOR = "#f5b400";
export const BRAND_BACKGROUND_COLOR = "#f7f2e8";

/** PWA manifest, regenerated into public/manifest.webmanifest at build time
 *  by scripts/generate-manifest.ts. */
export const BRAND_MANIFEST = {
  name: BRAND_NAME,
  short_name: BRAND_NAME,
  id: "/",
  description: BRAND_TAGLINE,
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: BRAND_BACKGROUND_COLOR,
  theme_color: BRAND_THEME_COLOR,
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
} as const;
