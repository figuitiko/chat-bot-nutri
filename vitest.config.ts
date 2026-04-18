import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      exclude: ["lib/db.ts", "lib/twilio.ts", "lib/env.ts"],
    },
  },
});
