import type { SchemaView } from '../SchemaView.js';

/** An entity class, whichever its fields — what a relation, a prefab or `json()` is handed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a row of any shape
export type Entity = SchemaView & (abstract new (...args: any[]) => any);
