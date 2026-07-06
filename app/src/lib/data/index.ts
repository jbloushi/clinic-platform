import { useMock } from '@/lib/env';
import type { DataProvider } from './provider';
import { openemrProvider } from './openemr/provider';

/**
 * Server-only factory. Never import from client components.
 * `USE_MOCK_DATA=true` (future) will swap to a MockProvider; for this phase
 * we go straight to OpenEMR against the live local instance.
 */
export function getDataProvider(): DataProvider {
  if (useMock) {
    throw new Error('MockProvider not implemented in this phase — set USE_MOCK_DATA=false');
  }
  return openemrProvider;
}
