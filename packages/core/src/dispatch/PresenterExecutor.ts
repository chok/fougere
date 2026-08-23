import { ErrorCode, FougereError } from '../wire/errors.js';
import { preserveArrayProperties } from './ArrayResult.js';

export type PresenterArgs = Record<string, unknown[]>;

/** Adds a presenter's computed fields after output projection. */
export class PresenterExecutor {
  constructor(
    private readonly presenter: Record<string, unknown> | undefined,
    private readonly fieldNames: readonly string[] | undefined,
    private readonly entity = 'unknown',
    private readonly operation = 'unknown',
  ) {}

  async present(result: unknown, args: PresenterArgs = {}): Promise<unknown> {
    if (!this.presenter || !this.fieldNames?.length || result === null || typeof result !== 'object') {
      return result;
    }

    const rows = Array.isArray(result) ? result : [result];
    const values = new Map<string, unknown[]>();

    for (const name of this.fieldNames) {
      const field = this.presenter[name];
      if (typeof field !== 'function') continue;
      try {
        const answered = await field.call(this.presenter, rows, ...(args[name] ?? []));
        if (!Array.isArray(answered) || answered.length !== rows.length) {
          const actual = Array.isArray(answered) ? answered.length : typeof answered;
          throw new Error(`expected ${rows.length} value(s) for ${rows.length} row(s), got ${actual}`);
        }
        values.set(name, answered);
      } catch (cause) {
        throw new FougereError({
          code: ErrorCode.INTERNAL_ERROR,
          message: `Computed field '${name}' failed: ${(cause as Error)?.message ?? cause}`,
          entity: this.entity,
          operation: this.operation,
          cause,
        });
      }
    }

    const enriched = rows.map((item, index) => {
      if (item === null || typeof item !== 'object') return item;
      const output = { ...(item as Record<string, unknown>) };
      for (const [name, answered] of values) output[name] = answered[index];
      return output;
    });

    return Array.isArray(result)
      ? preserveArrayProperties(result, enriched)
      : enriched[0];
  }
}
