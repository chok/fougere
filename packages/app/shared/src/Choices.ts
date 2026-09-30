import { invocationOf, itemsOf, sendCall } from './Designation.js';
import type { Fetcher } from './Fetcher.js';
import type { FormReference } from './FormField.js';

/** One row a reference may point at, as a form offers it. */
export interface Choice {
  value: string;
  label: string;
}

/** What one load offers, and whether the target holds more than it — which is when a search is worth showing. */
export interface Offer {
  choices: Choice[];
  more: boolean;
}

/** The rows a reference field offers — a handful, and a search to reach the others. */
export class Choices {
  /** Enough to choose among at a glance; the rest is what a search is for. */
  static readonly LIMIT = 20;

  /** The first rows of the target, or those whose label contains `text`. */
  static async of(fetcher: Fetcher, reference: FormReference, text = ''): Promise<Offer> {
    const where = text ? { [reference.label]: { contains: text } } : undefined;
    const answer = await sendCall(
      fetcher,
      { address: reference.to, op: 'list' },
      invocationOf({ query: { limit: Choices.LIMIT + 1, ...(where ? { where } : {}) } }),
    );
    const rows = itemsOf<Record<string, unknown>>(answer);

    return {
      choices: rows.slice(0, Choices.LIMIT).map((row) => ({
        value: String(row[reference.key]),
        label: String(row[reference.label] ?? row[reference.key]),
      })),
      more: rows.length > Choices.LIMIT,
    };
  }
}
