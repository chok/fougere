import { type SchemaView } from '@fougere/schema';

/** Select option — restrict returned fields to those of a SchemaView. */
export interface SelectOption {
  select?: SchemaView;
}
