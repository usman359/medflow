import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside a React Server environment; stub it for tests.
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/integration/**/*.test.ts"],
  },
})
