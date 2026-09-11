import { Storage } from '@fougere/core';

/**
 * A wrapper on the seam: it extends `Storage` and asks for one, which is the whole
 * declaration. Twelve gestures it says nothing about reach the storage underneath.
 */
export default class Counting extends Storage {
  constructor(private inner: Storage) {
    super(inner);
  }

  override async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    ((globalThis as Record<string, unknown>).__wrote as string[]).push(`counting(${String(input.title)})`);

    return this.inner.create(input);
  }
}
