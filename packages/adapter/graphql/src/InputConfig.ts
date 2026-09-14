import type { SchemaView } from '@fougere/schema';

export interface InputConfig {
  /** The GraphQL type name. */
  name: string;
  /** The view to project — derive it (`pick`/`omit`/`partial`) before handing it over. */
  schema: SchemaView;
}
