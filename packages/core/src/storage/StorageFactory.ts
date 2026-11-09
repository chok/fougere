import { type SchemaView } from '@fougere/schema';
import type { Storage } from './Storage.js';

/** Builds the storage of one entity; called by the boot for each. */
export type StorageFactory = (entity: SchemaView, name: string) => Storage;
