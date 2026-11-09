import { Visibility, type Fields, type SchemaView } from '@fougere/schema';
import { preserveArrayProperties } from './ArrayResult.js';
import { asPage } from '../wire/Page.js';

/**
 * What a caller receives, read back into the types its schema promises.
 * Ex: a `date-time` string becomes a `Date`.
 *
 * Documented: [the gradient](https://fougere.dev/docs/concepts/configuration).
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

  return Array.isArray(answer)
    ? preserveArrayProperties(answer, answer.map(row))
    : row(answer);
}
