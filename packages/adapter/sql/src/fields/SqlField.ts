import type { Engine } from './Engine.js';

export interface SqlField {
  /** The column type to emit, per engine. An engine absent here keeps the shape's own. */
  readonly columnType?: Readonly<Partial<Record<Engine, string>>>;
}
