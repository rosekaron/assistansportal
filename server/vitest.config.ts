import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    include:     ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      JWT_SECRET:        "test-secret-for-vitest",
      DATABASE_URL:      "postgres://test:test@localhost:5432/test",
      FK_HOURLY_RATE:    "334",
      EMPLOYER_TAX_RATE: "0.3142",
      NODE_ENV:          "test",
    },
  },
});
