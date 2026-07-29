import { useMock } from '@/lib/env';
import type { DataProvider } from './provider';
import { openemrProvider } from './openemr/provider';
import { mockProvider } from './mock/provider';

/**
 * Server-only factory. Never import from client components.
 * Selection happens only on the server and requires no UI changes.
 */
export function getDataProvider(): DataProvider {
  return useMock ? mockProvider : openemrProvider;
}
