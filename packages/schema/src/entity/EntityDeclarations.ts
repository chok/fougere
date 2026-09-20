import type { Fields } from '../field/Fields.js';
import type { EntityAdapters } from './EntityAdapters.js';
import type { FieldGroups } from './FieldGroups.js';
import type { PreviousNames } from './PreviousNames.js';

export interface EntityDeclarations<TFields extends Fields> {
  adapters?: EntityAdapters<TFields>;
  previous?: PreviousNames<TFields>;
  unique?: FieldGroups<TFields>;
  index?: FieldGroups<TFields>;
}
