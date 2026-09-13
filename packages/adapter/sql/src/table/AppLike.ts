import { type SchemaView } from '@fougere/schema';
import type { FrondLike } from './FrondLike.js';

export interface AppLike {
  fronds: FrondLike[];
  /** Auth runtime entities are migrated alongside scanned fronds when present. */
  auth?: { entities: Record<string, SchemaView> };
  /** Entities this app hosts in ANOTHER source — named so a miss can be read. */
  elsewhere?: string[];
}
