import { ValueJudge, type Fields } from '@fougere/schema';
import { assertListOptions } from '../storage.js';
import { ErrorCode, FougereError } from '../wire/errors.js';

/**
 * The three gestures this guard grafts onto. `list` is optional because not every storage
 * answers it, and declared HERE rather than described inline at the graft: a member the
 * intersection does not name cannot be assigned without a cast that hides the graft.
 */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  list?(...args: unknown[]): unknown;
}

/**
 * Judges storage writes and list options without narrowing the storage interface.
 *
 * Storage is a way out like the client surface, so what goes to it is judged too — the
 * same rule `OutputProjector` applies on the other exit.
 */
export class StorageGuard {
  constructor(
    private readonly fields: Fields,
    private readonly entity: string,
  ) {}

  guard<T extends object>(storage: T): T {
    const writer = storage as unknown as Writer;
    if (typeof writer.create !== 'function' || typeof writer.update !== 'function') return storage;

    const validation = this;
    const guarded = Object.create(storage) as T & Writer;

    guarded.create = async function (...args) {
      validation.judge(args[0], 'create');
      return writer.create.apply(this, args);
    };

    guarded.update = async function (...args) {
      validation.judge(args[1], 'update');
      return writer.update.apply(this, args);
    };

    const list = writer.list;
    if (typeof list === 'function') {
      guarded.list = async function (...args: unknown[]) {
        assertListOptions(args[0] as object | undefined, validation.entity);
        return list.apply(this, args);
      };
    }

    return guarded;
  }

  private judge(value: unknown, operation: string): void {
    if (typeof value !== 'object' || value === null) return;

    const errors: string[] = [];
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const field = this.fields[key];
      if (!field || item === undefined) continue;
      const checked = ValueJudge.of(field).validate(item);
      if ('error' in checked) errors.push(`${key}: ${checked.error}`);
    }

    if (errors.length > 0) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Refused on the way out — ${errors.join(', ')}`,
        entity: this.entity,
        operation,
        details: errors,
      });
    }
  }
}
