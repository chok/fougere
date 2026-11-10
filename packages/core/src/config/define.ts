import type { FougereConfig } from './FougereConfig.js';

/** Types a `fougere.config.ts` while keeping its literals. */
export function defineFougere<T extends FougereConfig>(config: T): T {
  return config;
}
