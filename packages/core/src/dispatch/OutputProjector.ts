import { encodeFields } from '@fougere/schema';
import { preserveArrayProperties } from './ArrayResult.js';
import type { OutputView } from './OutputView.js';

/**
 * Projects one operation result onto the fields its audience may read.
 *
 * One of the two exits a judge watches; `StorageGuard` is the other.
 */
export class OutputProjector {
  constructor(private readonly view: OutputView) {}

  project(result: unknown): unknown {
    if (result === null || result === undefined) return result;

    if (Array.isArray(result)) {
      return preserveArrayProperties(result, result.map((item) => this.project(item)));
    }

    if (typeof result !== 'object') return result;

    const record = result as Record<string, unknown>;
    const scoped = this.view.closed
      ? Object.fromEntries(
          Object.keys(this.view.fields)
            .filter((key) => key in record)
            .map((key) => [key, record[key]]),
        )
      : record;
    return encodeFields(this.view.fields, scoped);
  }
}
