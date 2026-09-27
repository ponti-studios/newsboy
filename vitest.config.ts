import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    clearMocks: true,
    fileParallelism: false,
  },
});
