/**
 * Regenerates public/manifest.webmanifest from the brand constants in
 * src/config/brand.ts so Chrome-theme and PWA colors stay in one place.
 * Runs as part of `pnpm build` (see packages/newsboy/package.json).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { BRAND_MANIFEST } from "../src/config/brand";

const manifestPath = fileURLToPath(new URL("../public/manifest.webmanifest", import.meta.url));

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(BRAND_MANIFEST, null, 2)}\n`);

console.log(`✓ wrote ${manifestPath}`);