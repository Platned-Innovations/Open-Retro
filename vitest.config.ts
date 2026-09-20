import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { TEST_DATABASE_URL } from "./tests/testDatabaseUrl";

export default defineConfig({
  // Resolves the `@/*` alias from tsconfig.json, so tests import exactly the
  // same specifiers the app does.
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws unless the bundler runs under React's
      // `react-server` condition. See tests/stubs/server-only.ts.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Set here rather than in a .env file so it is committed and identical in
    // CI. It must be in place before src/lib/prisma.ts reads it at import time.
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // One shared database, truncated between cases — parallel files would
    // delete each other's fixtures mid-test.
    fileParallelism: false,
    // Migrating and connecting on a cold container is slower than the default.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
