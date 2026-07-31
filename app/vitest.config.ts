import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests for the booking domain layer.
 *
 * Scoped to `src/lib` on purpose: the rules worth testing here — assignment
 * ranking, effective price and duration, overlap buckets, readiness — are pure
 * functions with no database or OpenEMR behind them. Deliberately excludes
 * `tests/integration/**` (see `vitest.integration.config.ts`) — those need a
 * live MySQL connection, so they must never run as a side effect of plain
 * `npm test`.
 */
export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
