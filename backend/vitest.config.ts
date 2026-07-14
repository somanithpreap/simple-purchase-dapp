import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
