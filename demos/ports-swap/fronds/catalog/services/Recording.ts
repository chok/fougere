import { Storage } from '@fougere/core';

/**
 * In front of every storage OF THIS FROND — `catalog`'s, and nobody else's.
 *
 * `Storage` is a SEAM: its realization is handed in (`storageFactory` builds one per
 * entity) rather than scanned, so a class extending it can only stand in front of it. The
 * twelve gestures this one says nothing about reach the storage underneath.
 *
 * The scope is the frond because that is what preserves the gradient: a link goes where its
 * frond goes, and `billing` moved behind `remotes:` would not silently lose one its own
 * code never mentioned. A link that must be everywhere is a FROND that is everywhere.
 */
export default class Recording extends Storage {
  constructor(private inner: Storage) {
    super(inner);
  }

  override async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    console.log(`   [catalog] a row was written through the link: ${JSON.stringify(input)}`);

    return this.inner.create(input);
  }
}
