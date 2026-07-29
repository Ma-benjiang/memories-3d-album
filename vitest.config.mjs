import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    coverage: {
      include: ["src/domain/**", "src/data/**"],
    },
  },
});
