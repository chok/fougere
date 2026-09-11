import { Storage } from '@fougere/core';

/**
 * In front of every entity's storage — including `catalog`'s, which this frond does not
 * name and has never heard of.
 *
 * `Storage` is a SEAM: its realization is handed in (`storageFactory` builds one per
 * entity) rather than scanned, so a class extending it can only stand in front of it. The
 * twelve gestures this one says nothing about reach the storage underneath.
 */
export default class Recording extends Storage {
  constructor(private inner: Storage) {
    super(inner);
  }

  override async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    console.log(`   [compliance] a row was written: ${JSON.stringify(input)}`);

    return this.inner.create(input);
  }
}
