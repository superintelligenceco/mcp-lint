import { defineConfig } from "vitest/config";

// Stryker runs the in-process unit and property tests against each mutant. The integration and
// CLI tests spawn real servers and are too slow to repeat for every mutant.
export default defineConfig({
  test: {
    setupFiles: ["test/setup.ts"],
    include: [
      "test/rules.test.ts",
      "test/score.test.ts",
      "test/argv.test.ts",
      "test/property.test.ts",
      "test/snapshot.test.ts",
    ],
  },
});
