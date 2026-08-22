import type { ValidationError } from './result.js';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

export const oneOfTokens = <T extends readonly string[]>(
  value: unknown,
  tokens: T,
): value is T[number] => typeof value === 'string' && (tokens as readonly string[]).includes(value);
