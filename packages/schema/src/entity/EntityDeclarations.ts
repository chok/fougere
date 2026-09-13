import type { Fields } from '../field/Fields.js';
import type { EntityAdapters } from './EntityAdapters.js';
import type { CompositeUnique } from './CompositeUnique.js';
import type { PreviousNames } from './PreviousNames.js';

export interface EntityDeclarations<TFields extends Fields> {
  adapters?: EntityAdapters<TFields>;
  previous?: PreviousNames<TFields>;
  unique?: CompositeUnique<TFields>;
}
