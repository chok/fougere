import { Visibility, type Fields } from '@fougere/schema';
import { preserveArrayProperties } from './ArrayResult.js';

/** What one operation result may show. One of the two exits a validator watches. */
export class OutputView {
  constructor(
    readonly fields: Fields,
    readonly closed = false,
  ) {}

  project(result: unknown): unknown {
    if (result === null || result === undefined) return result;

    if (Array.isArray(result)) {
      return preserveArrayProperties(result, result.map((item) => this.project(item)));
    }

    if (typeof result !== 'object') return result;

    const record = result as Record<string, unknown>;
    const scoped = this.closed
      ? Object.fromEntries(
          Object.keys(this.fields)
            .filter((key) => key in record)
            .map((key) => [key, record[key]]),
        )
      : record;

    return Visibility.of(this.fields).encode(scoped);
  }
}
