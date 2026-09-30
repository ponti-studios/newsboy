import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tailwindcss(),
    reactRouter(),
    ...(!isSsrBuild
      ? [
          VitePWA({
            // The worker is generated and registered only for production builds.
            // Vite's un-hashed dev modules must never be cached by a service worker.
            devOptions: { enabled: false },
            injectRegister: "auto",
            manifest: false,
            outDir: "build/client",
            registerType: "prompt",
            workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"] },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    cssMinify: "esbuild",
    sourcemap: true,
  },
}));
