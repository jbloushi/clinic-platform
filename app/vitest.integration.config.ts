import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Concurrency- and transaction-sensitive tests against the real local MySQL
 * (ADAPTER_DATABASE_URL) — separate from `vitest.config.ts` so a plain
 * `npm test` never needs a database connection.
 *
 * Run via `npm run test:integration`, which loads `.env.local` first.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    // These hit Prisma transactions and real timing races — give them more
    // room than the default 5s unit-test timeout.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
