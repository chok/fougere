import type { SchemaView } from '@fougere/schema';

export type EntityClass = SchemaView & (abstract new (...args: any[]) => any);
