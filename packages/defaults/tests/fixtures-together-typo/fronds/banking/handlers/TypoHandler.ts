import type { Together } from '@fougere/core';
import type Account from '../entities/Account.js';

/** A member that is neither an entity nor a class of this frond — a typo, and nothing else. */
export default class TypoHandler {
  constructor(private together: Together<[Account, Ledgre]>) {}

  /** Never reached. */
  async move(): Promise<void> {
    await this.together.run(async () => undefined);
  }
}

/** Declared so the file compiles; the boot still finds nothing under this name. */
type Ledgre = never;
