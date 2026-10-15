import type { SchemaView } from '@fougere/schema';

/** An entity this process knows, by the name a type wrote — `Post` in `Post['id']`. */
export type EntityLookup = (name: string) => SchemaView | undefined;
