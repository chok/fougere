import { Storage } from '@fougere/core';

/** A link its frond declares for its family — `ledger` answers at no address of its own. */
export default class Stamping extends Storage {
  constructor(private inner: Storage) {
    super(inner);
  }

  override async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    ((globalThis as Record<string, unknown>).__wrote as string[]).push(`stamping(${String(input.label)})`);

    return this.inner.create(input);
  }
}
