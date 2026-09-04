import type { FougereConfig } from './config-loader.js';

/**
 * Identity helper for fougere.config.ts — preserves literal types for autocomplete while
 * validating against FougereConfig.
 */
export function defineFougere<T extends FougereConfig>(config: T): T {
  return config;
}
