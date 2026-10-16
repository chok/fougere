import type { SourceConfig } from '@fougere/core';

/** Does this config ask for persistence at all? */
export function declaresStorage(sources: Record<string, SourceConfig> | undefined): boolean {
  return Object.keys(sources ?? {}).length > 0;
}
