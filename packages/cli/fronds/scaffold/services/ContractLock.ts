import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardFrond } from '@fougere/core';

/**
 * `fougere.lock.json` — the contract a consumer accepted, one entry per remote frond.
 *
 * It sits beside `fougere.config.ts`, and it is what a review reads: one declaration
 * per remote instead of the N generated files under `.fougere/`, so the diff of a
 * `sync` states in one place exactly what the other side changed.
 *
 * There is no broker to publish to and no deployment to record. What a host serves is
 * asked of the host, now; what this consumer accepted is read from here.
 *
 * The frond entry is stored VERBATIM as the card carried it: reformatting it would put a
 * second opinion between what was received and what is compared.
 */
export interface LockFile {
  version: 1;
  remotes: Record<string, { from: string; frond: CardFrond }>;
}

const FILE = 'fougere.lock.json';

export default class ContractLock {
  private path(root: string): string {
    return join(root, FILE);
  }

  /** The name a message uses, so a reader knows which file to open. */
  get filename(): string {
    return FILE;
  }

  read(root: string): LockFile {
    const path = this.path(root);
    if (!existsSync(path)) return { version: 1, remotes: {} };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      throw new Error(`${FILE} is not valid JSON`);
    }
    const lock = parsed as Partial<LockFile>;
    if (lock.version !== 1 || typeof lock.remotes !== 'object' || lock.remotes === null) {
      throw new Error(`${FILE} is not a Fougere lock file`);
    }
    return { version: 1, remotes: lock.remotes };
  }

  /**
   * Record what this consumer now compiles against.
   *
   * Written with sorted keys and a trailing newline: the file lands in a diff, and a
   * reordering that means nothing would read as a contract change.
   */
  accept(root: string, name: string, from: string, frond: CardFrond): void {
    const lock = this.read(root);
    lock.remotes[name] = { from, frond };
    const remotes: LockFile['remotes'] = {};
    for (const key of Object.keys(lock.remotes).sort()) remotes[key] = lock.remotes[key]!;
    writeFileSync(this.path(root), JSON.stringify({ version: 1, remotes }, null, 2) + '\n');
  }

  /** Drop a remote from the lock — nothing compiles against it any more. */
  forget(root: string, name: string): boolean {
    const lock = this.read(root);
    if (!(name in lock.remotes)) return false;
    delete lock.remotes[name];
    writeFileSync(this.path(root), JSON.stringify(lock, null, 2) + '\n');
    return true;
  }
}
