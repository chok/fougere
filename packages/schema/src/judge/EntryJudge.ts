import { Validator } from '@cfworker/json-schema';
import type { Shape } from '../schema/axis/shape/Shape.js';
import { isObject } from '../utils.js';

/**
 * What an adapter accepts under a field name, judged by the engine `schema` already ships.
 *
 * `EntityAdapterSet` owns the two levels an entry is ADDRESSED by — adapter, then field —
 * and judges nothing below them. This is how the level below gets a judge without `schema`
 * learning what is in it: the adapter states its format as DATA, and `schema` reads it. A
 * TypeScript interface cannot serve: it is erased before a JS caller, a config or a card
 * from another language could be measured against it.
 */
export class EntryJudge {
  private constructor(private readonly validator: Validator) {}

  /**
   * Compiles the format an adapter states, once, at that adapter's own module load.
   * FR : compile le format énoncé par un adaptateur, une fois, au chargement de son module.
   * `EntryJudge.of(ENTRY_FORMAT)` in `adapter/sql/src/fields.ts`
   */
  static of(format: Shape): EntryJudge {
    return new EntryJudge(new Validator(format as object, '2020-12', true));
  }

  /**
   * Refuses the first entry the format does not admit, naming the field and the key inside it.
   * FR : refuse la première entrée hors format, en nommant le champ et la clé fautive.
   * `check({ body: { columnType: { postgre: 'x' } } }, 'Post.adapters.sql')`
   * → throws `Post.adapters.sql.body.columnType: Property "postgre" does not match …`
   */
  assert(entries: unknown, path: string): void {
    if (entries === undefined) return;

    if (!isObject(entries)) {
      throw new Error(
        `${path}: expected an object keyed by field name, got ${typeof entries}.`,
      );
    }

    for (const [field, entry] of Object.entries(entries)) {
      const verdict = this.validator.validate(entry);
      if (verdict.valid) continue;

      // The engine reports outermost first and ends on `False boolean schema`, which names
      // nothing. The last unit above that one is the one carrying the offending key.
      const units = verdict.errors.filter((unit) => unit.keyword !== 'false');
      const named = units[units.length - 1] ?? verdict.errors[0];
      const inside = (named?.instanceLocation ?? '#').slice(1).replaceAll('/', '.');

      throw new Error(`${path}.${field}${inside}: ${named?.error ?? 'does not match the format'}`);
    }
  }
}
