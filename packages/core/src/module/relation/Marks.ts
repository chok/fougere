import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import type { StorageFactory } from '../../storage/StorageFactory.js';
import FougereTarget, { FOUGERE_TARGET } from './FougereTarget.js';

/** How a source keeps the marks a write and a release of its target wait for each other on. */
export interface Marks {
  /** True when only this process is arbitrated — a second one writing the same rows is not seen. */
  readonly inThisProcessOnly: boolean;
  /** Run `fn` holding these marks, handed the ones already `gone`: a release marking one waits until `fn` ends. */
  holding<R>(marks: readonly string[], fn: (factory: StorageFactory, gone: readonly string[]) => Promise<R>): Promise<R>;
  /** Mark these `gone` and run `fn`: a write holding one waits, and if `fn` throws the marks are as before. */
  marking<R>(marks: readonly string[], fn: (factory: StorageFactory) => Promise<R>): Promise<R>;
  forget(marks: readonly string[]): Promise<void>;
}

interface Mark {
  state?: string;
}

const LIVE = 'live';
const GONE = 'gone';

function keptIn(factory: StorageFactory) {
  return factory(FougereTarget, FOUGERE_TARGET);
}

async function forgetting(factory: StorageFactory, marks: readonly string[]): Promise<void> {
  for (const mark of marks) await keptIn(factory).delete(mark);
}

async function placing(factory: StorageFactory, marks: readonly string[]): Promise<void> {
  const kept = keptIn(factory);
  const found = await kept.findByKeys([...marks]);
  for (const mark of marks.filter((one) => !found.has(one))) {
    try {
      await kept.create({ id: mark, state: LIVE });
    } catch (refusal) {
      if (!await kept.findById(mark)) throw refusal;
    }
  }
}

class MarkForgotten extends Error {}

/**
 * The marks of a source with transactions: a row locked by `update(id, change)`, the lock each engine already has.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function marksInTransactions(
  transacted: <R>(fn: (factory: StorageFactory) => Promise<R>) => Promise<R>,
  factory: StorageFactory,
): Marks {
  const locking = async <R>(
    marks: readonly string[],
    stateFrom: (state: string | undefined) => string,
    fn: (bound: StorageFactory, gone: readonly string[]) => Promise<R>,
  ): Promise<R> => {
    for (let attempt = 1; ; attempt++) {
      await placing(factory, marks);
      try {
        return await transacted(async (bound) => {
          const gone: string[] = [];
          for (const mark of [...marks].sort()) await lock(bound, mark, stateFrom, gone);

          return fn(bound, gone);
        });
      } catch (stopped) {
        if (!(stopped instanceof MarkForgotten) || attempt === MAX_PLACINGS) throw stopped;
      }
    }
  };

  return {
    inThisProcessOnly: false,
    holding: (marks, fn) => locking(marks, (state) => state ?? LIVE, fn),
    marking: (marks, fn) => locking(marks, () => GONE, (bound) => fn(bound)),
    forget: (marks) => forgetting(factory, marks),
  };
}

const MAX_PLACINGS = 3;

async function lock(
  bound: StorageFactory,
  mark: string,
  stateFrom: (state: string | undefined) => string,
  gone: string[],
): Promise<void> {
  try {
    await keptIn(bound).update(mark, async (current: Mark) => {
      if (current.state === GONE) gone.push(mark);

      return { state: stateFrom(current.state) };
    });
  } catch (refusal) {
    if (refusal instanceof FougereError && refusal.code === ErrorCode.NOT_FOUND) throw new MarkForgotten();
    throw refusal;
  }
}

class MarkLocks {
  private readers = new Map<string, number>();
  private writers = new Set<string>();
  private waiting: (() => void)[] = [];

  async share(marks: readonly string[]): Promise<void> {
    while (marks.some((mark) => this.writers.has(mark))) await this.turn();
    for (const mark of marks) this.readers.set(mark, (this.readers.get(mark) ?? 0) + 1);
  }

  async own(marks: readonly string[]): Promise<void> {
    while (marks.some((mark) => this.writers.has(mark) || (this.readers.get(mark) ?? 0) > 0)) await this.turn();
    for (const mark of marks) this.writers.add(mark);
  }

  unshare(marks: readonly string[]): void {
    for (const mark of marks) {
      const left = (this.readers.get(mark) ?? 1) - 1;
      if (left === 0) this.readers.delete(mark); else this.readers.set(mark, left);
    }
    this.wake();
  }

  disown(marks: readonly string[]): void {
    for (const mark of marks) this.writers.delete(mark);
    this.wake();
  }

  private turn(): Promise<void> {
    return new Promise((resolve) => { this.waiting.push(resolve); });
  }

  private wake(): void {
    for (const resolve of this.waiting.splice(0)) resolve();
  }
}

/**
 * The marks of a source with no transaction, arbitrated by a lock in this process.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function marksInProcess(factory: StorageFactory): Marks {
  const locks = new MarkLocks();

  return {
    inThisProcessOnly: true,
    holding: async (marks, fn) => {
      await locks.share(marks);
      try {
        await placing(factory, marks);
        const found = await keptIn(factory).findByKeys([...marks]);
        const gone = marks.filter((mark) => (found.get(mark) as Mark | undefined)?.state === GONE);

        return await fn(factory, gone);
      } finally {
        locks.unshare(marks);
      }
    },
    marking: async (marks, fn) => {
      await locks.own(marks);
      try {
        await placing(factory, marks);
        const before = await keptIn(factory).findByKeys([...marks]);
        for (const mark of marks) await keptIn(factory).update(mark, { state: GONE });
        try {
          return await fn(factory);
        } catch (refusal) {
          for (const mark of marks) await keptIn(factory).update(mark, { state: (before.get(mark) as Mark | undefined)?.state ?? LIVE });
          throw refusal;
        }
      } finally {
        locks.disown(marks);
      }
    },
    forget: (marks) => forgetting(factory, marks),
  };
}
