import { Validator } from '@cfworker/json-schema';
import type { Shape } from '../axis/shape/Shape.js';
import { isObject } from '../lib/utils.js';

/**
 * The format is DATA, not a TypeScript interface: an interface is erased before a JS
 * caller, a config or a card from another language could be measured against it.
 */
export class AdapterFieldValidator {
  private constructor(private readonly validator: Validator) {}

  /** Compiled once, at the adapter's own module load. */
  static of(format: Shape): AdapterFieldValidator {
    return new AdapterFieldValidator(new Validator(format as object, '2020-12', true));
  }

  /** `Post.adapters.sql.body.columnType: Property "postgre" does not match …` */
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
      const failure = units[units.length - 1] ?? verdict.errors[0];
      const nested = (failure?.instanceLocation ?? '#').slice(1).replaceAll('/', '.');

      throw new Error(`${path}.${field}${nested}: ${failure?.error ?? 'does not match the format'}`);
    }
  }
}
