import type { ValidationError } from '../../judge/result.js';

/** A card is refused by naming what is wrong AND the remedy — never by a bare throw. */
export function refuse(what: string, fix: string): never {
  throw new Error(`This card cannot be read: ${what}.\n  ${fix}`);
}

/**
 * A wire value admitted by the axis's OWN judge — legal only where its declared and wire
 * forms are the same value, which `describe: v => v` states.
 */
export function admitWire(
  judge: (value: unknown, errors: ValidationError[]) => void,
  value: unknown,
  slot: string,
): void {
  const errors: ValidationError[] = [];
  judge(value, errors);
  if (errors.length) {
    refuse(
      `${slot} is malformed — ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
      'A card states an axis the way a declaration does.',
    );
  }
}
