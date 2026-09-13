import type { CollectorResolver } from './CollectorResolver.js';

export type CollectorLookup = (typeName: string) => CollectorResolver | undefined;
