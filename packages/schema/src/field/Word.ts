import type { Shape } from '../axis/shape/Shape.js';
import { Format, type Accepted } from '../lib/Format.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { dotted } from '../lib/ValidationResult.js';
import { isObject } from '../lib/utils.js';
import { JsonSchemaValidator } from '../validator/JsonSchemaValidator.js';
import { SchemaError } from '../SchemaError.js';
import { Field, type Shared } from './Field.js';

/** One option of a word: the JSON Schema keyword it writes, the format of its value, and how it writes it. */
export type WordOption = readonly [keyword: string, format: Format<any>, write?: (value: any) => unknown];

/** What a word admits, read off its table — the type is never written beside it. */
export type OptionsOf<Table extends Record<string, WordOption>> = { [K in keyof Table]?: Accepted<Table[K][1]> };

/** The same, for a word whose keys write no keyword — read off the formats of its keys. */
export type OptionsIn<Keys extends Record<string, Format<any>>> = { [K in keyof Keys]?: Accepted<Keys[K]> };

/** The two keys every shaping word admits: the sentence it carries, and the value it is born with. */
const SHARED = { description: Format.text, default: Format.anything } as const;

/** What a word that shapes no value admits — a relation, a stamp: the sentence and nothing else. */
export const DESCRIBED = { description: Format.text } as const;

/**
 * The keys a word admits, as a closed format — so an option it does not know is refused under its
 * own name, where reading only the keys it knew used to drop `minn` without a word.
 */
export function admits(
  word: string,
  keys: Record<string, Format<unknown>>,
  shared: Record<string, Format<unknown>> = SHARED,
): Format<unknown> {
  return Object.entries({ ...shared, ...keys })
    .reduce((held, [name, format]) => held.key(name, format), Format.of(`vocabulary/${word}`))
    .closed();
}

/** Judge a word's options by the format of its keys — `text(42)` and `text({ minn: 1 })` alike. */
export function judgeOptions(word: string, format: Format<unknown>, opts: unknown): void {
  if (opts === undefined) return;
  if (!isObject(opts)) throw new SchemaError('Options must go in an object, like { max: 200 }', { received: opts });

  const refusal = JsonSchemaValidator.of(format.schema as JsonSchema).refusalOf(opts, [`${word}()`]);
  if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);
}

/**
 * A word, declared as a table: its base shape, and each option with the keyword it writes. The
 * closed format, the options type and the shape all derive from that one table.
 * `word<string>()('text', { type: 'string' }, { max: ['maxLength', Format.count] })`
 */
export function word<T>() {
  return <Table extends Record<string, WordOption>>(name: string, base: Shape, table: Table) => {
    const format = admits(name, Object.fromEntries(Object.entries(table).map(([key, [, value]]) => [key, value])));

    return (opts?: OptionsOf<Table> & Shared<T>): Field<T> => {
      judgeOptions(name, format, opts);

      const written = Object.entries(table)
        .filter(([key]) => opts?.[key as keyof typeof opts] !== undefined)
        .map(([key, [keyword, , write]]) => {
          const value = opts![key as keyof typeof opts];

          return [keyword, write ? write(value) : value] as const;
        });

      return new Field<T>({ shape: { ...base, ...Object.fromEntries(written) } as Shape }).setShared(opts);
    };
  };
}
