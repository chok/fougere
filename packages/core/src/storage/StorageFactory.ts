import { type SchemaView } from '@fougere/schema';
import type { Storage } from './Storage.js';

/**
 * Factory that creates a Storage for a given entity.
 * Called by bootstrap for every scanned entity.
 */
export type StorageFactory = (entity: SchemaView, name: string) => Storage;
