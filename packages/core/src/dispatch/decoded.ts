import { Visibility, type Fields, type SchemaView } from '@fougere/schema';
import { preserveArrayProperties } from './ArrayResult.js';
import { asPage } from '../wire/Page.js';

/**
 * What a caller receives, read back into the shape its type promises — the dual of
 * `OutputView.project`, applied on the other side of the call.
 *
 * `date-time` means a `Date` on both sides (`Boundary.forShape`), and only the outgoing half was
 * ever applied: `Visibility.encode` turned `new Date(0)` into `"1970-01-01T00:00:00.000Z"` and
 * nobody turned it back, so `Facade<PostHandler>` promised `createdAt: Date` and handed over a
 * string — in this process as well as across a wire.
 *
 * Applied by the facade a caller HOLDS, never by the one that answers: a row leaves as data,
 * which is what a Rust frond or a plain HTTP client reads, and the codecs are what this side
 * knows how to put back. Measured 2026-09-18: 389 ns per row against the 1 277 ns encoding one
 * already costs.
 *
 * Documented: [the gradient](https://fougere.dev/docs/infra/gradient).
 */
export function decoded(schema: SchemaView | undefined, answer: unknown): unknown {
  if (!schema || answer === null || answer === undefined) return answer;

  const fields = schema.getFields() as Fields;
  const visibility = Visibility.of(fields);
  const row = (one: unknown) => (one !== null && typeof one === 'object' && !Array.isArray(one)
    ? visibility.decode(one as Record<string, unknown>)
    : one);

  const page = asPage(answer, fields);
  if (page) return { ...page, items: page.items.map(row) };

  // An op annotating `ListResult<T>` still answers the array those properties ride on.
  return Array.isArray(answer)
    ? preserveArrayProperties(answer, answer.map(row))
    : row(answer);
}
