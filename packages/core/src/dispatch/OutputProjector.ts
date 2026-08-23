import { encodeFields, type Fields } from '@fougere/schema';
import { preserveArrayProperties } from './ArrayResult.js';

/** Projects one operation result onto the fields its audience may read. */
export class OutputProjector {
  constructor(
    private readonly fields: Fields,
    private readonly closed = false,
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
    return encodeFields(this.fields, scoped);
  }
}
