import { invocationOf, itemsOf, sendCall } from './Designation.js';
import type { Fetcher } from './Fetcher.js';
import type { FormReference } from './FormField.js';

/** One row a reference may point at, as a form offers it. */
export interface Choice {
  value: string;
  label: string;
}

/** The rows a reference field offers — a handful, and a search to reach the others. */
export class Choices {
  /** Enough to choose among at a glance; the rest is what a search is for. */
  static readonly LIMIT = 20;

  /** The first rows of the target, or those whose label contains `text`. */
  static async of(fetcher: Fetcher, reference: FormReference, text = ''): Promise<Choice[]> {
    const where = text ? { [reference.label]: { contains: text } } : undefined;
    const answer = await sendCall(
      fetcher,
      { entity: reference.to, op: 'list' },
      invocationOf({ query: { limit: Choices.LIMIT, ...(where ? { where } : {}) } }),
    );

    return itemsOf<Record<string, unknown>>(answer).map((row) => ({
      value: String(row[reference.key]),
      label: String(row[reference.label] ?? row[reference.key]),
    }));
  }
}
