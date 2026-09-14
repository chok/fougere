import type { SeedFactory } from './SeedFactory.js';

/** A discovered seed file (array of records or async factory). */
export interface SeedEntry {
  /** Entity name this seed targets (from filename: Author.seed.ts → 'author'). */
  entityName: string;
  /** Raw default export — array or function. Resolved at runtime. */
  data: Record<string, unknown>[] | SeedFactory;
  /** Absolute file path (for debugging). */
  filePath: string;
}
