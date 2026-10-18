import type { Term } from '@fougere/registry';

/** A term a `vocabulary/` file exports — by the name it is exported under, so a statement can import it. */
export interface VocabularyEntry {
  term: Term<unknown>;
  name: string;
  filePath: string;
}
