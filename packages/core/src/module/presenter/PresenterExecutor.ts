import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import { preserveArrayProperties } from '../../dispatch/ArrayResult.js';
import type { PresenterArgs } from './PresenterArgs.js';
import { asPage } from '../../wire/Page.js';

/** Adds a presenter's computed fields after output projection. */
export class PresenterExecutor {
  constructor(
    private readonly presenter: Record<string, unknown> | undefined,
    private readonly fieldNames: readonly string[] | undefined,
  ) {}

  async present(result: unknown, args: PresenterArgs = {}): Promise<unknown> {
    if (!this.presenter || !this.fieldNames?.length || result === null || typeof result !== 'object') {
      return result;
    }

    // A paged op answers an envelope, and what a computed field sits on is a ROW. Handed the
    // envelope itself, a presenter added its fields to `{ items, total }` and every row came
    // back untouched.
    const page = asPage(result, Object.fromEntries(this.fieldNames.map((name) => [name, true])));
    if (page) return { ...page, items: await this.present(page.items, args) as unknown[] };

    const rows = Array.isArray(result) ? result : [result];
    const values = new Map<string, unknown[]>();
    for (const name of this.fieldNames) {
      const answer = await this.computed(name, rows, args[name] ?? []);
      if (answer) values.set(name, answer);
    }

    const enriched = rows.map((item, index) => {
      if (item === null || typeof item !== 'object') return item;

      const output = { ...(item as Record<string, unknown>) };
      for (const [name, answered] of values) output[name] = answered[index];

      return output;
    });

    return Array.isArray(result) ? preserveArrayProperties(result, enriched) : enriched[0];
  }

  /**
   * One computed field, handed the whole PAGE — so one query per page is possible where one per
   * row was not. It answers for every row or for none: a shorter list would silently shift the
   * values onto the wrong rows.
   */
  private async computed(name: string, rows: unknown[], args: unknown[]): Promise<unknown[] | undefined> {
    const field = this.presenter?.[name];
    if (typeof field !== 'function') return undefined;

    try {
      const answer = await field.call(this.presenter, rows, ...args);
      if (!Array.isArray(answer) || answer.length !== rows.length) {
        const actual = Array.isArray(answer) ? answer.length : typeof answer;
        throw new Error(`expected ${rows.length} value(s) for ${rows.length} row(s), got ${actual}`);
      }

      return answer;
    } catch (cause) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Computed field '${name}' failed: ${(cause as Error)?.message ?? cause}`,
        cause,
      });
    }
  }
}
