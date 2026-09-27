import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "../src"),
      // The real module only exists when the app's VitePWA plugin runs, so
      // point pwa-update-prompt.tsx at a Storybook mock instead.
      "virtual:pwa-register/react": path.resolve(
        import.meta.dirname,
        "mocks/pwa-register-react.ts",
      ),
    },
  },
});